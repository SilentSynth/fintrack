from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(dotenv_path=BASE_DIR / ".env", override=False)
load_dotenv(dotenv_path=Path.cwd() / ".env", override=False)


@lru_cache(maxsize=1)
def get_settings() -> dict[str, object]:
    return {
        "news_api_key": os.getenv("NEWS_API_KEY", "").strip(),
        "gemini_api_key": os.getenv("GEMINI_API_KEY", "").strip(),
        "fmp_api_key": os.getenv("FMP_API_KEY", "").strip(),
        "news_api_url": os.getenv("NEWS_API_URL", "https://newsapi.org/v2/everything").strip(),
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip(),
        "cors_origins": [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://127.0.0.1:5173",
            ).split(",")
            if origin.strip()
        ],
    }
