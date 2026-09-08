import asyncio
import base64
import copy
import datetime
import decimal
import logging
import os
import re
import tomllib
from typing import Any, Dict, Optional, Tuple

import aiofiles
import httpx
from fastapi import Depends, Request
from pyjexl import JEXL
from pyjexl.parser import Identifier, Literal
from sqlalchemy.exc import DatabaseError, DisconnectionError
from sqlalchemy.orm import Session

from src.constants import SLOT_ID_TO_DIS_TYPE
from src.db import get_db
from src.models import DocumentStatusType, UserApplications, UserDocuments, Users
from src.services.form_context import derived_context, row_to_dict
from src.services.berlin_districts import resolve_berlin_district
from src.utils import get_google_id_token

logger = logging.getLogger(__name__)

FORM_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_-]+$")
_DOCUMENT_REF_RE = re.compile(r"documents\.([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?")

# Distinguishes "referenced as a whole object" (refs[type] is None) from
# "not referenced by the mapping at all" (absent from refs).
_UNREFERENCED = object()


def _extract_document_refs(mapping: Dict[str, Any]) -> Dict[str, set[str] | None]:
    refs: Dict[str, set[str] | None] = {}
    for val in mapping.values():
        if not isinstance(val, str):
            continue
        for match in _DOCUMENT_REF_RE.finditer(val):
            doc_type = match.group(1)
            key = match.group(2)
            if key is None:
                refs[doc_type] = None
            elif doc_type not in refs:
                refs[doc_type] = {key}
            elif refs[doc_type] is not None:
                refs[doc_type].add(key)
    return refs


def _collect_identifier_roots(node: Any, out: set[str]) -> None:
    """Walks a pyjexl AST node, collecting the root context key of every identifier
    chain (e.g. `documents.wage_slips.gross_amount` contributes only `documents`)."""
    if node is None or isinstance(node, Literal):
        return
    if isinstance(node, Identifier):
        if node.subject is None:
            out.add(node.value)
        else:
            _collect_identifier_roots(node.subject, out)
        return
    for field_name in getattr(node, "fields", []):
        if field_name == "parent":
            continue
        value = getattr(node, field_name, None)
        if isinstance(value, list):
            for item in value:
                _collect_identifier_roots(item, out)
        else:
            _collect_identifier_roots(value, out)


def _extract_required_context_fields(mapping: Dict[str, Any], jexl: JEXL) -> set[str]:
    """
    Collects the top-level context keys a mapping's JEXL expressions read from,
    used to judge whether a user's profile carries enough data to fill this form.
    Fields under the `documents.*` namespace are excluded: those come from verified
    document uploads rather than the profile, and aren't required to check readiness.
    """
    fields: set[str] = set()
    for val in mapping.values():
        if not isinstance(val, str):
            continue
        for match in re.finditer(r"\{\{\s*(.*?)\s*\}\}", val, flags=re.DOTALL):
            try:
                tree = jexl.parse(match.group(1))
            except Exception:
                continue
            _collect_identifier_roots(tree, fields)
    fields.discard("documents")
    return fields


def _is_context_value_filled(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    if isinstance(value, (list, dict, tuple, set)):
        return len(value) > 0
    return True


class FormAssetCacheManager:
    """
    A highly secure, thundering-herd-resistant, in-memory cache for PDF form assets.
    Uses realpath directory boundary containment checks and shielded task coalescing.
    """

    def __init__(self, ttl_seconds: float | None = None):
        self.ttl_seconds = ttl_seconds
        # Cache structure: {form_name: (mapping, field_types, pdf_bytes, last_checked_time)}
        self._cache: Dict[str, Tuple[Dict[str, Any], Dict[str, str], bytes, float]] = {}
        self._inflight_tasks: Dict[str, asyncio.Task] = {}

    def _validate_paths(self, form_name: str, mapping_dir: str, pdf_dir: str) -> Tuple[str, str]:
        if not FORM_NAME_PATTERN.match(form_name):
            logger.error(f"Security Violation: Invalid form name pattern: {form_name}")
            raise ValueError(f"Invalid form name: {form_name}")

        # Use realpath to fully resolve symlinks and strictly block directory traversal
        abs_mapping_dir = os.path.realpath(mapping_dir)
        abs_pdf_dir = os.path.realpath(pdf_dir)

        # Append trailing separator to ensure strict directory boundary matching
        if not abs_mapping_dir.endswith(os.sep):
            abs_mapping_dir += os.sep
        if not abs_pdf_dir.endswith(os.sep):
            abs_pdf_dir += os.sep

        mapping_file = os.path.realpath(os.path.join(abs_mapping_dir, f"{form_name}.toml"))
        pdf_file = os.path.realpath(os.path.join(abs_pdf_dir, f"{form_name}.pdf"))

        if not mapping_file.startswith(abs_mapping_dir) or not pdf_file.startswith(abs_pdf_dir):
            logger.error(f"Security Violation: Path traversal detected: mapping={mapping_file}, pdf={pdf_file}")
            raise PermissionError("Access Denied: Path traversal blocked.")

        return mapping_file, pdf_file

    async def get_assets(
        self, form_name: str, mapping_dir: str, pdf_dir: str
    ) -> Tuple[Dict[str, Any], Dict[str, str], bytes]:
        mapping_file, pdf_file = self._validate_paths(form_name, mapping_dir, pdf_dir)

        # Dynamic cache validation (in-memory time-based TTL)
        now = asyncio.get_running_loop().time()
        if form_name in self._cache:
            mapping, field_types, pdf_bytes, cached_time = self._cache[form_name]
            if self.ttl_seconds is None or now - cached_time < self.ttl_seconds:
                # Deep copy mutable dictionaries to prevent cross-request state contamination
                return copy.deepcopy(mapping), copy.deepcopy(field_types), pdf_bytes

        # Lock-Free Single-Flight Coalescing for concurrent cold hits
        task = self._inflight_tasks.get(form_name)
        if not task or task.done():
            logger.info(f"Cache MISS. Spawning loader for: {form_name}")
            task = asyncio.create_task(self._load_assets_from_disk(form_name, mapping_file, pdf_file))
            self._inflight_tasks[form_name] = task

        try:
            # CRITICAL: Shield the shared background task from caller-specific cancellations!
            mapping, field_types, pdf_bytes = await asyncio.shield(task)
            return copy.deepcopy(mapping), copy.deepcopy(field_types), pdf_bytes
        except asyncio.CancelledError:
            # Caller request was cancelled, but background task continues running to warm the cache
            raise
        except BaseException:
            if self._inflight_tasks.get(form_name) == task:
                self._inflight_tasks.pop(form_name, None)
            raise

    async def _load_assets_from_disk(
        self, form_name: str, mapping_file: str, pdf_file: str
    ) -> Tuple[Dict[str, Any], Dict[str, str], bytes]:
        try:
            # Read mapping and load TOML (raises FileNotFoundError directly if missing)
            async with aiofiles.open(mapping_file, "rb") as f:
                mapping_content = await f.read()
                raw_mapping = tomllib.loads(mapping_content.decode("utf-8"))

            mapping = {}
            field_types = {}
            for field_id, field_info in raw_mapping.items():
                if isinstance(field_info, dict):
                    field_types[field_id] = field_info.get("type")
                    mapping[field_id] = field_info.get("value")
                else:
                    mapping[field_id] = field_info

            # Read PDF template bytes
            async with aiofiles.open(pdf_file, "rb") as f:
                pdf_bytes = await f.read()

            assets = (mapping, field_types, pdf_bytes)
            now = asyncio.get_running_loop().time()
            self._cache[form_name] = (*assets, now)

            return assets
        except FileNotFoundError as e:
            logger.error(f"Asset loading failed: File not found {e.filename}")
            raise
        except Exception as e:
            logger.error(f"Unexpected asset loading error: {str(e)}")
            raise
        finally:
            self._inflight_tasks.pop(form_name, None)

    def clear(self):
        self._cache.clear()
        self._inflight_tasks.clear()


# Global Thread/Process-safe Cache Singleton
_ttl_env = os.environ.get("FORM_CACHE_TTL_SECONDS")
_ttl = float(_ttl_env) if _ttl_env is not None else None
ASSET_CACHE_MANAGER = FormAssetCacheManager(ttl_seconds=_ttl)


async def _get_form_assets(
    form_name: str, mapping_dir: str, pdf_dir: str
) -> Tuple[Dict[str, Any], Dict[str, str], bytes]:
    """
    Delegating wrapper function to preserve backward compatibility with tests
    while utilizing the modern, thread-safe FormAssetCacheManager.
    """
    return await ASSET_CACHE_MANAGER.get_assets(form_name, mapping_dir, pdf_dir)


class FormService:
    def __init__(
        self, db: Session, forms_dir: str = None, forms_filler_url: str = None, http_client: httpx.AsyncClient = None
    ):
        self.forms_dir = forms_dir or os.environ.get("FORMS_ROOT", "/app/forms")
        self.mapping_path = os.path.join(self.forms_dir, "mappings")
        self.pdfs_path = os.path.join(self.forms_dir, "pdfs")
        self.filler_url = forms_filler_url or os.environ.get(
            "ENDPOINT_FORMS_FILLER", "http://forms-filling-service:8080"
        )
        self.db = db
        self.http_client = http_client
        self.jexl = JEXL()

    def _build_base_context(self, form_type: str, user: Users) -> Tuple[Dict[str, Any], Optional[UserApplications]]:
        """
        Builds the JEXL context from `Users` columns merged with the matching
        application's `form_data`. Falls back to the user's most recently updated
        application when no row has this exact `form_type` — older accounts were
        written with form_type="grundsicherung" while exports ask for
        "antrag_grundsicherung".

        Does not include the `documents` namespace; `fill_form` layers that on top
        using the returned application, since it's the only caller that needs it.
        """
        user_dict = row_to_dict(user)

        if not user_dict.get("district") and user_dict.get("zip_code"):
            city = user_dict.get("city", "")
            if city and city.strip().lower() == "berlin":
                user_dict["district"] = resolve_berlin_district(
                    db=self.db,
                    street=user_dict.get("street"),
                    house_number=user_dict.get("house_number"),
                    zip_code=user_dict.get("zip_code"),
                )

        form_data: Dict[str, Any] = {}
        application: Optional[UserApplications] = None
        try:
            application = (
                self.db.query(UserApplications)
                .filter(
                    UserApplications.fk_user_id == user.id,
                    UserApplications.form_type == form_type,
                )
                .order_by(UserApplications.updated_at.desc())
                .first()
            )
            if application is None:
                application = (
                    self.db.query(UserApplications)
                    .filter(UserApplications.fk_user_id == user.id)
                    .order_by(UserApplications.updated_at.desc())
                    .first()
                )
                if application:
                    logger.info(
                        "No application with form_type=%r; falling back to most recent application %s (form_type=%r)",
                        form_type,
                        application.application_id,
                        application.form_type,
                    )
            if application and application.form_data:
                form_data = application.form_data
        except DatabaseError:
            logger.warning("Internal database error")
        except DisconnectionError:
            logger.warning("Database is currently not reachable")

        context = user_dict.copy()
        context.update(derived_context(user_dict, user.associated_persons))
        for k, v in form_data.items():
            if k in context:
                logger.warning(f"Key collision for {k}. Skipping document value and keeping user profile value.")
            else:
                context[k] = v

        return context, application

    async def get_completeness(self, form_type: str, user: Users) -> Tuple[int, int]:
        """
        Reports how many of the profile fields a form's mapping reads from are
        filled in, so the frontend can show a per-form readiness indicator without
        needing to know each form's specific field list. Deliberately ignores the
        `documents` namespace: document verification isn't required to generate
        these simpler (non-Grundsicherung) forms today.
        """
        mapping, _field_types, _pdf_bytes = await _get_form_assets(form_type, self.mapping_path, self.pdfs_path)
        required_fields = _extract_required_context_fields(mapping, self.jexl)
        if not required_fields:
            return 0, 0

        context, _application = self._build_base_context(form_type, user)
        filled = sum(1 for field in required_fields if _is_context_value_filled(context.get(field)))
        return filled, len(required_fields)

    async def fill_form(self, form_type: str, user: Users) -> bytes:
        """
        Fills a PDF form using a merged JEXL context built from the user profile
        and the user's most recently updated `user_applications` row for the given
        `form_type`. The application contributes two namespaces:

        * `form_data` (JSONB) — form-specific data collected via the LLM
        * `documents` — a map of `document_type` to the most recently verified
          `user_documents.raw_data` JSONB for that application (VERIFIED status
          only). Empty when no verified documents exist.

        On top-level key collision, `Users` columns take precedence over
        `form_data`. The `documents` namespace is isolated from `Users` columns
        to avoid name collisions.
        """
        mapping, field_types, pdf_bytes = await _get_form_assets(form_type, self.mapping_path, self.pdfs_path)
        needed_refs = _extract_document_refs(mapping)
        context, application = self._build_base_context(form_type, user)

        documents_ctx: Dict[str, Dict[str, Any]] = {}
        if application and needed_refs:
            try:
                verified_docs = (
                    self.db.query(UserDocuments.raw_data, UserDocuments.document_type)
                    .filter(
                        UserDocuments.fk_application_id == application.application_id,
                        UserDocuments.fk_user_id == user.id,
                        UserDocuments.status == DocumentStatusType.VERIFIED,
                    )
                    .order_by(UserDocuments.document_type, UserDocuments.created_at.desc())
                    .all()
                )
                for doc in verified_docs:
                    if not doc.raw_data:
                        continue
                    # Documents are stored under frontend slot ids (`id_card`, `rent`, …)
                    # while the TOML mappings reference document-intelligence registry
                    # names (`documents.identity_document.*`). The two vocabularies
                    # overlap on `pension_notice` alone, so register each document under
                    # both names and let the mapping use whichever it was written against.
                    aliases = {
                        doc.document_type,
                        SLOT_ID_TO_DIS_TYPE.get(doc.document_type, doc.document_type),
                    }
                    for alias in aliases:
                        if alias in documents_ctx:
                            continue
                        needed = needed_refs.get(alias, _UNREFERENCED)
                        if needed is _UNREFERENCED:
                            continue
                        if needed is None:
                            documents_ctx[alias] = dict(doc.raw_data)
                        else:
                            documents_ctx[alias] = {k: v for k, v in doc.raw_data.items() if k in needed}
            except DatabaseError:
                logger.warning("Internal database error")
            except DisconnectionError:
                logger.warning("Database is currently not reachable")

        context["documents"] = documents_ctx

        filled_values = {}
        for field_id, default_value in mapping.items():
            # Check if the field is a checkbox by checking parsed field types
            is_checkbox = field_types.get(field_id) == "checkbox"

            if isinstance(default_value, str):
                stripped_val = default_value.strip()
                # If the string is a pure JEXL expression, evaluate it first
                try:
                    if (
                        stripped_val.startswith("{{")
                        and stripped_val.endswith("}}")
                        and stripped_val.count("{{") == 1
                        and stripped_val.count("}}") == 1
                    ):
                        res = self.jexl.evaluate(stripped_val[2:-2].strip(), context)
                    else:

                        def _eval(m):
                            val_res = self.jexl.evaluate(m.group(1), context)
                            if isinstance(val_res, bool):
                                return "Ja" if val_res else ""
                            if isinstance(val_res, (datetime.date, datetime.datetime)):
                                return val_res.strftime("%d.%m.%Y")
                            return str(val_res) if val_res is not None else ""

                        res = re.sub(r"\{\{\s*(.*?)\s*\}\}", _eval, stripped_val, flags=re.DOTALL)
                except Exception as e:
                    # One unevaluable mapping entry must not fail the whole export.
                    logger.warning(f"Mapping field {field_id!r} could not be evaluated: {e}")
                    res = None
            else:
                res = default_value

            # Coerce values depending on whether the field is a checkbox
            if is_checkbox:
                res = False if res in (None, False, "", "False", "false", "0", "Off", "off") else True
            else:
                if res is None:
                    res = ""
                elif isinstance(res, bool):
                    res = "Ja" if res else ""
                elif isinstance(res, (datetime.date, datetime.datetime)):
                    res = res.strftime("%d.%m.%Y")
                elif isinstance(res, (decimal.Decimal, float, int)):
                    res = str(res)
                elif isinstance(res, (list, tuple)):
                    res = ", ".join(str(item) for item in res)

            filled_values[field_id] = res

        payload = {
            "pdf_base64": base64.b64encode(pdf_bytes).decode("utf-8"),
            "field_values": filled_values,
            "ignore_read_only": True,
        }

        headers = {}
        token = get_google_id_token(self.filler_url)
        if token:
            headers["Authorization"] = f"Bearer {token}"

        url = f"{self.filler_url}/api/fill"
        logger.info(f"Calling forms-filling-service at {url}")

        if self.http_client:
            response = await self.http_client.post(url, json=payload, timeout=60.0, headers=headers)
        else:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, json=payload, timeout=60.0)

        if response.status_code != 200:
            try:
                error_data = response.json()
                detail = error_data.get("detail", str(error_data))
            except Exception:
                detail = response.text
            logger.error(f"Forms filler error: {detail}")
            raise Exception(f"Forms filler error: {detail}")
        return response.content


def get_form_service(request: Request, db: Session = Depends(get_db)) -> FormService:
    """
    FastAPI dependency to provide a FormService instance with the shared httpx client.
    """
    http_client = getattr(request.app.state, "http_client")
    return FormService(db=db, http_client=http_client)
