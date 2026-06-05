from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from app.schemas import InsightsResponse
from app.services.ai_service import (
    generate_ai_summary,
    classify_entity,
    generate_private_company_profile,
)
from app.services.news_service import fetch_news
from app.services.stock_service import fetch_stock_snapshot


router = APIRouter(tags=["insights"])

@router.get("/insights/{query:path}/summary")
@router.get("/api/insights/{query:path}/summary")
async def get_insights_summary(query: str) -> dict[str, Any]:
    normalized_query = query.strip()
    if not normalized_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    entity_type = await classify_entity(normalized_query)
    if entity_type == "INVALID":
        raise HTTPException(
            status_code=400,
            detail="Invalid search query. Please enter a valid ticker, company name, or economic sector.",
        )

    if entity_type == "PUBLIC":
        stock_result, news_result = await asyncio.gather(
            fetch_stock_snapshot(normalized_query),
            fetch_news(normalized_query),
        )
        view_mode = str(stock_result.get("view_mode", "ticker"))
    else:
        news_result = await fetch_news(normalized_query)
        view_mode = "macro_sector"

    ai_result = await generate_ai_summary(
        normalized_query,
        news_result.get("news_articles", []),
        view_mode,
    )

    return {
        "current_market_state": ai_result.get("current_market_state", []),
        "critical_developments": ai_result.get("critical_developments", []),
        "sentiment_score": ai_result.get("sentiment_score", 5),
        "alerts": ai_result.get("alerts", []),
    }

@router.get("/insights/{query:path}", response_model=InsightsResponse)
@router.get("/api/insights/{query:path}", response_model=InsightsResponse)
async def get_insights(query: str) -> dict[str, Any]:
    normalized_query = query.strip()
    if not normalized_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    entity_type = await classify_entity(normalized_query)
    if entity_type == "INVALID":
        raise HTTPException(
            status_code=400,
            detail="Invalid search query. Please enter a valid ticker, company name, or economic sector.",
        )

    if entity_type == "PUBLIC":
        stock_result, news_result = await asyncio.gather(
            fetch_stock_snapshot(normalized_query),
            fetch_news(normalized_query),
        )
    elif entity_type == "PRIVATE":
        private_profile, news_result = await asyncio.gather(
            generate_private_company_profile(normalized_query),
            fetch_news(normalized_query),
        )
        stock_result = {
            "ticker": None,
            "company_name": normalized_query,
            "current_price": None,
            "market_cap": None,
            "currency": None,
            "currency_symbol": "",
            "historical_prices": [],
            "has_live_quote": False,
            "is_market_open": False,
            "view_mode": "macro_sector",
            "description": private_profile.get("description"),
            "sector": private_profile.get("sector"),
            "industry": private_profile.get("industry"),
            "website": private_profile.get("website"),
            "full_time_employees": private_profile.get("full_time_employees"),
        }
    else: # SECTOR
        news_result = await fetch_news(normalized_query)
        stock_result = {
            "ticker": None,
            "company_name": normalized_query,
            "current_price": None,
            "market_cap": None,
            "currency": None,
            "currency_symbol": "",
            "historical_prices": [],
            "has_live_quote": False,
            "is_market_open": False,
            "view_mode": "macro_sector",
            "description": None,
            "sector": None,
            "industry": None,
            "website": None,
            "full_time_employees": None,
        }

    ai_result = {
        "current_market_state": [],
        "critical_developments": [],
        "sentiment_score": 5,
        "alerts": [],
    }

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
            "currency": stock_result.get("currency"),
            "has_live_quote": stock_result.get("has_live_quote", False),
            "is_market_open": stock_result.get("is_market_open", False),
            "view_mode": view_mode,
            "description": stock_result.get("description"),
            "sector": stock_result.get("sector"),
            "industry": stock_result.get("industry"),
            "website": stock_result.get("website"),
            "full_time_employees": stock_result.get("full_time_employees"),
            "entity_type": entity_type,
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

