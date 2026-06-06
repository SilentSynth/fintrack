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

    if not isinstance(stock_result, dict):
        stock_result = {}

    fallback_name = locals().get("search_ticker") or normalized_query

    if not stock_result.get("company_name") or not str(stock_result.get("company_name")).strip():
        stock_result["company_name"] = fallback_name

    desc = stock_result.get("description")
    sector = stock_result.get("sector")
    if not desc or len(str(desc).strip()) < 150 or (sector and str(sector).strip() == 'Financial / General'):
        gemini_success = False
        try:
            from google import genai
            from google.genai import types
            from app.core.settings import get_settings

            settings = get_settings()
            gemini_api_key = settings.get("gemini_api_key")
            if gemini_api_key:
                client = genai.Client(api_key=gemini_api_key)
                model_name = settings.get("gemini_model") or "gemini-2.5-flash"
                prompt = f'Provide a financial profile for the company/asset "{normalized_query}". Return EXACTLY in this format: Description|Sector|Industry. The description must be 2 to 3 professional sentences.'

                def _call_gemini():
                    return client.models.generate_content(
                        model=model_name,
                        contents=prompt,
                        config=types.GenerateContentConfig(
                            temperature=0.0,
                        ),
                    )

                response = await asyncio.wait_for(asyncio.to_thread(_call_gemini), timeout=5.0)
                if response and response.text:
                    cleaned_res = response.text.strip()
                    if cleaned_res.startswith("```"):
                        lines = cleaned_res.splitlines()
                        if lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].startswith("```"):
                            lines = lines[:-1]
                        cleaned_res = "\n".join(lines).strip()

                    parts = cleaned_res.split('|')
                    if len(parts) == 3:
                        ai_desc = parts[0].strip()
                        ai_sector = parts[1].strip()
                        ai_industry = parts[2].strip()
                        if ai_desc and ai_sector and ai_industry:
                            stock_result["description"] = ai_desc
                            stock_result["sector"] = ai_sector
                            stock_result["industry"] = ai_industry
                            gemini_success = True

            if not gemini_success:
                raise ValueError("Format mismatch or empty response from LLM")
        except Exception as e:
            print(f"DEBUG: Gemini fallback profile generation failed or timed out: {e}")
            stock_result["description"] = "Company profile unavailable."
            stock_result["sector"] = "Financial / General"
            stock_result["industry"] = "Market Asset"
    else:
        if not stock_result.get("sector") or not str(stock_result.get("sector")).strip():
            stock_result["sector"] = "Financial / General"

        if not stock_result.get("industry") or not str(stock_result.get("industry")).strip():
            stock_result["industry"] = "Market Asset"

    if not stock_result.get("website") or not str(stock_result.get("website")).strip():
        stock_result["website"] = "#"

    if stock_result.get("current_price") is None or stock_result.get("current_price") == "":
        stock_result["current_price"] = 0.0

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

