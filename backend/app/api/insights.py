from __future__ import annotations

import asyncio
import json
import logging
import os
import traceback
from typing import Any

from fastapi import APIRouter, HTTPException
import google.generativeai as genai

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

    if not stock_result.get("website") or not str(stock_result.get("website")).strip():
        stock_result["website"] = "#"

    if stock_result.get("current_price") is None or stock_result.get("current_price") == "":
        stock_result["current_price"] = 0.0

    alerts = []
    alerts.extend(stock_result.get("alerts", []))
    alerts.extend(news_result.get("alerts", []))
    alerts.extend(ai_result.get("alerts", []))

    view_mode = str(stock_result.get("view_mode", "ticker"))

    # Populate profile_data immediately before return
    profile_data = {
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
    }

    desc_val = profile_data.get("description")
    if not desc_val or len(str(desc_val).strip()) < 150:
        try:
            gemini_api_key = os.environ.get("GEMINI_API_KEY")
            if not gemini_api_key:
                logging.warning("VERCEL ENVIRONMENT VARIABLE GEMINI_API_KEY IS MISSING")
                raise ValueError("VERCEL ENVIRONMENT VARIABLE GEMINI_API_KEY IS MISSING")

            try:
                if 'model' in globals():
                    fallback_model = globals()['model']
                else:
                    import google.generativeai as genai
                    genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
                    fallback_model = genai.GenerativeModel('gemini-3.5-flash')
            except Exception:
                import google.generativeai as genai
                genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
                fallback_model = genai.GenerativeModel('gemini-3.5-flash')

            ticker_val = profile_data.get("ticker") or normalized_query
            prompt = f"""
Act as a financial data API. Provide a 3-sentence company summary, the sector, and the industry for the asset/company query "{normalized_query}" (ticker: "{ticker_val}").

Return ONLY a valid JSON object with the following keys:
- "description": A professional 3-sentence summary of the company.
- "sector": The accurate financial sector.
- "industry": The accurate financial industry.

Do not include any other text or explanation. Return ONLY the JSON.
""".strip()

            response = fallback_model.generate_content(
                prompt,
                generation_config={"response_mime_type": "application/json"}
            )
            
            if response and response.text:
                parsed = json.loads(response.text.strip())
                if "description" in parsed and "sector" in parsed and "industry" in parsed:
                    profile_data["description"] = str(parsed["description"]).strip()
                    profile_data["sector"] = str(parsed["sector"]).strip()
                    profile_data["industry"] = str(parsed["industry"]).strip()
                else:
                    raise ValueError("Parsed JSON missing required keys")
            else:
                raise ValueError("Empty response from Gemini")
        except Exception as e:
            logging.error(f"Gemini synchronous fallback profile generation failed: {type(e).__name__}: {e}")
            logging.error(traceback.format_exc())
            profile_data["description"] = f"{normalized_query} is a publicly traded international asset. Detailed real-time corporate analytics are temporarily adjusting."
            profile_data["sector"] = "Financial"
            profile_data["industry"] = "General"
    else:
        if not profile_data.get("sector") or not str(profile_data.get("sector")).strip():
            profile_data["sector"] = "Financial"
        if not profile_data.get("industry") or not str(profile_data.get("industry")).strip():
            profile_data["industry"] = "General"

    return {
        "query": normalized_query,
        "view_mode": view_mode,
        "stock_data": profile_data,
        "historical_prices": stock_result.get("historical_prices", []),
        "news_articles": news_result.get("news_articles", []),
        "ai_summary": {
            "current_market_state": ai_result.get("current_market_state", []),
            "critical_developments": ai_result.get("critical_developments", []),
            "sentiment_score": ai_result.get("sentiment_score", 5),
        },
        "alerts": alerts,
    }

