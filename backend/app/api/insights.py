from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from app.schemas import InsightsResponse
from app.services.ai_service import generate_ai_summary
from app.services.news_service import fetch_news
from app.services.stock_service import fetch_stock_snapshot


router = APIRouter(prefix="/api", tags=["insights"])


@router.get("/insights/{query:path}", response_model=InsightsResponse)
async def get_insights(query: str) -> dict[str, Any]:
    normalized_query = query.strip()
    if not normalized_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    stock_task = asyncio.create_task(fetch_stock_snapshot(normalized_query))
    news_task = asyncio.create_task(fetch_news(normalized_query))

    async def build_summary() -> dict[str, Any]:
        stock_result, news_result = await asyncio.gather(stock_task, news_task)
        return await generate_ai_summary(
            normalized_query,
            news_result.get("news_articles", []),
            str(stock_result.get("view_mode", "ticker")),
        )

    ai_task = asyncio.create_task(build_summary())

    stock_result, news_result, ai_result = await asyncio.gather(stock_task, news_task, ai_task)

    alerts = []
    alerts.extend(stock_result.get("alerts", []))
    alerts.extend(news_result.get("alerts", []))
    alerts.extend(ai_result.get("alerts", []))

    view_mode = str(stock_result.get("view_mode", "ticker"))

    return {
        "query": normalized_query,
        "view_mode": view_mode,
        "stock_data": {
            "query": normalized_query,
            "ticker": stock_result.get("ticker"),
            "company_name": stock_result.get("company_name"),
            "current_price": stock_result.get("current_price"),
            "market_cap": stock_result.get("market_cap"),
            "currency": stock_result.get("currency", "USD"),
            "has_live_quote": stock_result.get("has_live_quote", False),
            "view_mode": view_mode,
        },
        "historical_prices": stock_result.get("historical_prices", []),
        "news_articles": news_result.get("news_articles", []),
        "ai_summary": {
            "current_market_state": ai_result.get("current_market_state", []),
            "critical_developments": ai_result.get("critical_developments", []),
            "sentiment_score": ai_result.get("sentiment_score", 5),
        },
        "alerts": alerts,
    }
