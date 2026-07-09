import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from src.utils.config import AUTHENTIK_SERVER_URL
from src.utils.db import init_db_pool, close_db_pool
from src.api import require_auth, login_start, login_finish, logout, verify_auth

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info(f"Starting auth-service, connecting to Authentik at {AUTHENTIK_SERVER_URL}")
    await init_db_pool()
    yield
    # Shutdown logic
    logger.info("Shutting down auth-service")
    await close_db_pool()


app = FastAPI(title="Auth Service", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://beyond-forms-frontend.web.app",
        "https://staging.bf.citylab-berlin.org",
        "https://prod.bf.citylab-berlin.org",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# Include routers
app.include_router(require_auth.router)
app.include_router(login_start.router)
app.include_router(login_finish.router)
app.include_router(logout.router)
app.include_router(verify_auth.router)

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
