from typing import Optional
from fastapi import APIRouter, Depends
from beyondforms.auth import User, get_current_user

router = APIRouter()


@router.get("/verify_auth")
async def verify_auth(current_user: Optional[User] = Depends(get_current_user)):
    if current_user is None:
        return {
            "is_authenticated": False,
            "user": "No session",
            "user_name": "None",
            "session_id": "None",
        }

    return {
        "is_authenticated": True,
        "user": current_user.user_id,
        "user_name": current_user.user_name,
        "session_id": current_user.session_id,
    }
