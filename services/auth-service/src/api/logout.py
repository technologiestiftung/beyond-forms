from fastapi import APIRouter, Response

router = APIRouter()


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("authentik_session")
    return {"message": "Logged out successfully"}
