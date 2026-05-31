from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import httpx

from app.core.settings import get_settings
from app.schemas import Alert


def _normalize_articles(items: list[dict[str, Any]], query: str) -> list[dict[str, Any]]:
    articles: list[dict[str, Any]] = []

    for item in items[:5]:
        source = item.get("source") or {}
        published_at = item.get("publishedAt") or datetime.now(timezone.utc).isoformat()
        articles.append(
            {
                "title": item.get("title") or query,
                "url": item.get("url") or "https://newsapi.org",
                "source": source.get("name") or "NewsAPI",
                "published_at": published_at,
                "description": item.get("description") or item.get("content") or None,
            }
        )

    return articles


def _fallback_news_payload(query: str, message: str) -> dict[str, Any]:
    return {
        "news_articles": [],
        "alerts": [
            Alert(
                type="warning",
                title="News feed unavailable",
                message=message,
            ).model_dump(),
        ],
    }


async def fetch_news(query: str) -> dict[str, Any]:
    settings = get_settings()
    news_api_key = str(settings["news_api_key"])
    news_api_url = str(settings["news_api_url"])

    if not news_api_key:
        return _fallback_news_payload(
            query,
            "NEWS_API_KEY is not configured. Live news is disabled until the API key is added.",
        )

    params = {
        "q": query,
        "pageSize": 5,
        "sortBy": "publishedAt",
        "language": "en",
        "apiKey": news_api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(news_api_url, params=params)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response else 0
        if status_code == 429:
            message = "NewsAPI rate limit reached. Try again in a moment."
        else:
            message = "NewsAPI returned an error while loading the news feed."
        return _fallback_news_payload(query, message)
    except httpx.HTTPError:
        return _fallback_news_payload(
            query,
            "The live news service is temporarily unavailable. Please try again shortly.",
        )

    if payload.get("status") != "ok":
        return _fallback_news_payload(
            query,
            payload.get("message") or "The live news service returned an unexpected response.",
        )

    articles = _normalize_articles(payload.get("articles", []), query)
    return {
        "news_articles": articles,
        "alerts": [],
    }
