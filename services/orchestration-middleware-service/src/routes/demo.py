"""
Demo-persona seeding endpoints.

The router is only mounted when `DEMO_SEED_ENABLED=true` (see `src/main.py`), so these
paths 404 rather than 403 in production.

`GET /personas` is unauthenticated: it only reads the persona JSON files committed to the
repo, which contain no real data, so there is nothing to protect. Every write path
(`POST`/`DELETE /seed`) stays behind `require_authenticated_user` plus a drama-number
check, and resolves the target user from the caller's own token — never from the request
body, unlike the `X-Internal-Token` pattern in `main.py`, where a leaked key would permit
writes to arbitrary profiles.
"""

import logging
import os

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from beyondforms.auth import User as AuthUser, is_test_account, require_authenticated_user
from src.db import get_db
from src.routes.files import get_storage_client
from src.services.demo_seed_service import DemoSeedError, DemoSeedService
from src.services.user_service import UserService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/demo", tags=["demo"])


def demo_seed_enabled() -> bool:
    return os.environ.get("DEMO_SEED_ENABLED", "").strip().lower() == "true"


class SeedRequest(BaseModel):
    persona: str = Field(..., description="Persona slug, e.g. 'helmut'. See GET /api/v1/demo/personas.")
    reset: bool = Field(True, description="Clear existing documents, application and profile first.")


def get_demo_service_readonly(db: Session = Depends(get_db)) -> DemoSeedService:
    return DemoSeedService(db)


def get_demo_service_for_caller(
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
) -> tuple[DemoSeedService, AuthUser]:
    if not is_test_account(current_user.user_name):
        # The caller is a real account. Refuse regardless of what they asked for.
        logger.warning("Demo seeding refused for non-test account.")
        raise HTTPException(
            status_code=403,
            detail="Demo seeding is only available for test accounts (Bundesnetzagentur drama numbers).",
        )
    return DemoSeedService(db, storage_client=get_storage_client()), current_user


def _internal_user_id(db: Session, current_user: AuthUser):
    """
    Resolves the caller's internal id, never a requested one.

    A 404 here means the account exists in Authentik but has no `users` row yet, which
    happens if the login flow was interrupted — auth-service's `get_or_create_user` is
    the only writer of that row and this service must not create it.
    """
    return UserService(db).get_internal_user_id(current_user.user_name)


@router.get("/personas")
async def list_personas(service: DemoSeedService = Depends(get_demo_service_readonly)):
    """Lists the available personas, including the research context behind each one."""
    return {"personas": service.list_personas()}


@router.post("/seed")
async def seed_persona(
    payload: SeedRequest = Body(...),
    service_and_user=Depends(get_demo_service_for_caller),
    db: Session = Depends(get_db),
):
    """
    Writes a persona's profile, application and pre-verified documents onto the caller.

    Bypasses the document-intelligence pipeline entirely: extractions come from the
    reviewed fixture, so no Gemini call is made and nothing is published to Pub/Sub.
    """
    service, current_user = service_and_user
    internal_user_id = _internal_user_id(db, current_user)
    try:
        return service.seed(internal_user_id, payload.persona, reset=payload.reset)
    except DemoSeedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Demo seeding failed for persona %s: %s", payload.persona, exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Demo seeding failed: {exc}") from exc


@router.delete("/seed")
async def reset_account(
    reset_tutorials: bool = False,
    service_and_user=Depends(get_demo_service_for_caller),
    db: Session = Depends(get_db),
):
    """
    Returns the caller's account to a cold start.

    Keeps the `users` row (nulled in place) and the Authentik account, so the same demo
    login works for the next seed without another SMS-flow round trip.
    """
    service, current_user = service_and_user
    internal_user_id = _internal_user_id(db, current_user)
    try:
        return service.reset(internal_user_id, reset_tutorials=reset_tutorials)
    except DemoSeedError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
