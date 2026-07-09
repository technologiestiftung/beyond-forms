from fastapi import FastAPI
from src.api import fields, fill

from typing import Dict

app = FastAPI(title="Forms Filling Service")


@app.get("/health")
async def health_check() -> Dict[str, str]:
    return {"status": "healthy"}


# Include routers
app.include_router(fields.router, prefix="/api")
app.include_router(fill.router, prefix="/api")
