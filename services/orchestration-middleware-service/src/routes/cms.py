from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from sqlalchemy.dialects.postgresql import insert
import logging

from beyondforms.auth import User as AuthUser, require_authenticated_user
from src.db import get_db
from src.models import CmsTutorials, UserTutorialStates
from src.schemas import TutorialResponseSchema, TutorialProgressUpdatePayload
from src.services.user_service import UserService, get_user_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["cms"])


@router.get("/my-tutorials", response_model=list[TutorialResponseSchema])
def get_my_tutorials(
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
):
    try:
        user_id = user_service.get_internal_user_id(current_user.user_name)
    except HTTPException as e:
        if e.status_code == 404:
            return []
        raise e

    # Fetch all tutorials with left join on user state (N+1 fixed)
    query_results = (
        db.query(CmsTutorials, UserTutorialStates)
        .outerjoin(
            UserTutorialStates,
            and_(UserTutorialStates.tutorial_id == CmsTutorials.id, UserTutorialStates.user_id == user_id),
        )
        .order_by(CmsTutorials.sort_order)
        .all()
    )

    results = []
    for tutorial, state in query_results:
        progress = {
            "status": state.status if state else "not_started",
            "current_step": state.current_step if state else None,
        }

        results.append(
            {
                "id": tutorial.id,
                "slug": tutorial.slug,
                "title": tutorial.title,
                "subtitle": tutorial.subtitle,
                "progress": progress,
                "content": tutorial.content,  # Maps to 'steps' in schema
            }
        )

    return results


@router.patch("/my-tutorials/progress")
def update_progress(
    payload: TutorialProgressUpdatePayload,
    current_user: AuthUser = Depends(require_authenticated_user),
    db: Session = Depends(get_db),
    user_service: UserService = Depends(get_user_service),
):
    user_id = user_service.get_internal_user_id(current_user.user_name)

    # Check if tutorial exists
    tutorial = db.query(CmsTutorials).filter(CmsTutorials.id == payload.tutorial_id).first()
    if not tutorial:
        raise HTTPException(status_code=404, detail="Tutorial not found")

    # Atomic UPSERT using PostgreSQL dialect
    stmt = insert(UserTutorialStates).values(
        user_id=user_id, tutorial_id=payload.tutorial_id, status=payload.status, current_step=payload.current_step
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["user_id", "tutorial_id"],
        set_={"status": payload.status, "current_step": payload.current_step, "updated_at": func.now()},
    )

    try:
        db.execute(stmt)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to update progress")
        raise HTTPException(status_code=500, detail="Internal server error")

    return {"status": "success"}
