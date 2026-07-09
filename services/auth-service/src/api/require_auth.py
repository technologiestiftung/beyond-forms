from fastapi import APIRouter, Depends
from beyondforms.auth import User, require_authenticated_user

router = APIRouter()


@router.get("/require_auth")
async def require_auth(current_user: User = Depends(require_authenticated_user)):
    return {"message": "Endpoint requiring authentication", "user": current_user.user_id}
