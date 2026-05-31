from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.insights import router as insights_router
from app.core.settings import get_settings


settings = get_settings()

app = FastAPI(title="FinTrack Insights API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings["cors_origins"]),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(insights_router)


@app.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}
