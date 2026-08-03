from contextlib import asynccontextmanager
import httpx
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import os
import secrets
import logging
from sqlalchemy.orm import Session

from src.routes import user, files, llm, application, cms, form_export
from beyondforms.auth import User as AuthUser, get_current_user
from src.db import get_db, SessionLocal
from src.models import UserDocuments, Users

from src.services.pubsub_service import initialize_pubsub


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize global httpx client
    app.state.http_client = httpx.AsyncClient()
    yield
    # Clean up
    await app.state.http_client.aclose()


initialize_pubsub()
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
app = FastAPI(title="Beyond Forms - Orchestration Middleware API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://beyond-forms-frontend.web.app",
        "http://localhost:5173",
        "http://localhost:8080",
        "https://staging.bf.citylab-berlin.org",
        "https://prod.bf.citylab-berlin.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """
    Health check endpoint for service monitoring
    """
    return {"status": "healthy!"}


@app.get("/version")
async def version():
    return {"version": "v0.1"}


@app.get("/verify_auth")
async def verify_auth(current_user: Optional[AuthUser] = Depends(get_current_user)):
    if current_user is None:
        return {"is_authenticated": False, "user": None, "session_id": None}
    return {
        "is_authenticated": current_user.is_authenticated,
        "user_id": current_user.user_id,
        "user_name": current_user.user_name,
        "session_id": current_user.session_id,
    }


# Active connection storage registry for WebSocket instances (mapped by Authentik user_id)
active_connections: dict[str, list[WebSocket]] = {}


@app.post("/api/v1/internal/documents/{document_id}/notify")
async def notify_document_processed(
    document_id: str,
    x_internal_token: Optional[str] = Header(None, alias="X-Internal-Token"),
    db: Session = Depends(get_db),
):
    """
    Secure internal notification route triggered by background worker.py.
    Validates token and broadcasts extraction events to active user WebSockets.
    """
    expected_token = os.environ.get("INTERNAL_API_KEY")
    if (
        not expected_token
        or not x_internal_token
        or not secrets.compare_digest(x_internal_token.encode("utf-8"), expected_token.encode("utf-8"))
    ):
        raise HTTPException(status_code=403, detail="Invalid internal authentication token")

    # Lookup target user account linked to this specific document
    doc = db.query(UserDocuments).filter(UserDocuments.document_id == document_id).first()
    if not doc or not doc.fk_user_id:
        return {"status": "ignored", "reason": "No user context found for document"}

    uid = str(doc.fk_user_id)
    if uid in active_connections:
        closed_sockets = []
        payload = json.dumps({"type": "DOCUMENT_PROCESSED", "document_id": str(document_id)})
        for ws in active_connections[uid]:
            try:
                await ws.send_text(payload)
            except Exception:
                closed_sockets.append(ws)
        # Lazy clean up disconnected instances
        for ws in closed_sockets:
            if ws in active_connections[uid]:
                active_connections[uid].remove(ws)

    return {"status": "success"}


@app.websocket("/ws/documents")
async def websocket_endpoint(websocket: WebSocket):
    """
    Active real-time WebSocket pipeline connecting the client wallet frontend to middleware sync notifications.
    """
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    current_user = await get_current_user(token=token)
    if not current_user or not current_user.user_name:
        await websocket.close(code=4003)
        return

    try:
        db = SessionLocal()
        try:
            user_row = db.query(Users).filter(Users.phone_number == current_user.user_name).first()
            if not user_row:
                await websocket.close(code=4004)
                return
            uid = str(user_row.id)
        finally:
            db.close()
    except Exception as e:
        logger.exception(f"Database error during WebSocket initialization: {str(e)}")
        await websocket.close(code=4500)
        return

    await websocket.accept()
    if uid not in active_connections:
        active_connections[uid] = []
    active_connections[uid].append(websocket)

    try:
        while True:
            # Maintain socket link context open and alive
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if uid in active_connections and websocket in active_connections[uid]:
            active_connections[uid].remove(websocket)
            if not active_connections[uid]:
                del active_connections[uid]


app.include_router(user.router)
app.include_router(files.router)
app.include_router(llm.router)
app.include_router(application.router)
app.include_router(form_export.router)
app.include_router(cms.router, prefix="/cms")

# Demo-persona seeding is mounted only where it is explicitly enabled, so the routes do
# not exist at all in production (404 rather than 403 — nothing to fingerprint). The
# handlers apply a second gate: they only ever seed the caller's own test account.
if os.environ.get("DEMO_SEED_ENABLED", "").strip().lower() == "true":
    from src.routes import demo

    app.include_router(demo.router)
    logger.warning("DEMO_SEED_ENABLED=true: demo persona seeding routes are mounted at /api/v1/demo.")
