import logging
import re
import unicodedata
from typing import Optional

from sqlalchemy.orm import Session
from src.data.berlin_zip_code_to_district import BERLIN_ZIP_CODE_TO_DISTRICT
from src.models import BerlinAddress

logger = logging.getLogger(__name__)

BERLIN_DISTRICTS = [
    "Charlottenburg-Wilmersdorf",
    "Friedrichshain-Kreuzberg",
    "Lichtenberg",
    "Marzahn-Hellersdorf",
    "Mitte",
    "Neukölln",
    "Pankow",
    "Reinickendorf",
    "Spandau",
    "Steglitz-Zehlendorf",
    "Tempelhof-Schöneberg",
    "Treptow-Köpenick",
]


def _normalize_name(value: str) -> str:
    folded = unicodedata.normalize("NFKD", value)
    ascii_only = "".join(c for c in folded if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "", ascii_only.lower())


def _match_official_district(candidate: str) -> Optional[str]:
    if not candidate:
        return None
    normalized = _normalize_name(candidate)
    for official in BERLIN_DISTRICTS:
        if _normalize_name(official) == normalized:
            return official
    for official in BERLIN_DISTRICTS:
        official_norm = _normalize_name(official)
        if normalized in official_norm or official_norm in normalized:
            return official
    return None


def _clean_plz(zip_code: Optional[str]) -> Optional[str]:
    if not zip_code:
        return None
    cleaned = re.sub(r"\s+", "", str(zip_code).strip())
    return cleaned if re.fullmatch(r"\d{5}", cleaned) else None


def _normalize_street(value: Optional[str]) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _normalize_house_number(value: Optional[str]) -> str:
    return "".join(str(value or "").lower().strip().split())


def _lookup_via_local_db(
    db: Session, street: Optional[str], house_number: Optional[str], zip_code: str
) -> Optional[str]:
    street_norm = _normalize_street(street)
    hnr_norm = _normalize_house_number(house_number)
    if not (street_norm and hnr_norm):
        return None

    nested = db.begin_nested()
    try:
        exact_match = (
            db.query(BerlinAddress.bez_name)
            .filter(BerlinAddress.plz == zip_code, BerlinAddress.street == street_norm, BerlinAddress.hnr == hnr_norm)
            .limit(1)
            .scalar()
        )

        if exact_match:
            nested.commit()
            return _match_official_district(exact_match)
    except Exception as exc:
        logger.warning("Berlin address lookup failed: %s", exc)
        nested.rollback()

    return None


def resolve_berlin_district(
    *,
    db: Session,
    street: Optional[str] = None,
    house_number: Optional[str] = None,
    zip_code: Optional[str] = None,
) -> Optional[str]:
    plz = _clean_plz(zip_code)
    if not plz:
        return None

    candidates = BERLIN_ZIP_CODE_TO_DISTRICT.get(plz)
    if not candidates:
        return None

    if len(candidates) == 1:
        return candidates[0]

    address_match = _lookup_via_local_db(db, street, house_number, plz)
    if address_match and address_match in candidates:
        return address_match

    return None


def sync_berlin_district(
    *,
    db: Session,
    street: Optional[str] = None,
    house_number: Optional[str] = None,
    zip_code: Optional[str] = None,
    city: Optional[str] = None,
) -> Optional[str]:
    if not city or city.strip().lower() != "berlin":
        return None
    return resolve_berlin_district(
        db=db,
        street=street,
        house_number=house_number,
        zip_code=zip_code,
    )
