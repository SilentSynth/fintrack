from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from functools import lru_cache

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.settings import get_settings
from app.schemas import Alert


def _compact_news_context(news_articles: list[dict[str, Any]]) -> str:
    if not news_articles:
        return "No live articles were available."

    lines = []
    for index, article in enumerate(news_articles[:4], start=1):
        title = article.get("title", "Untitled headline")
        description = article.get("description") or ""
        source = article.get("source", "Unknown source")
        lines.append(f"{index}. {title} | {source} | {description}")
    return "\n".join(lines)


def _strip_code_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    start = cleaned.find('{')
    end = cleaned.rfind('}')
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start:end+1]
    return cleaned


def _normalize_string_list(value: Any, desired_length: int | None = None) -> list[str]:
    if isinstance(value, list):
        items = [str(item).strip() for item in value if str(item).strip()]
    elif isinstance(value, str):
        items = [line.strip(" -*•\t") for line in value.splitlines() if line.strip(" -*•\t")]
    else:
        items = []

    if desired_length is not None and len(items) > desired_length:
        return items[:desired_length]
    return items


def _fallback_sentiment_score(news_articles: list[dict[str, Any]]) -> int:
    text = " ".join(
        f"{article.get('title', '')} {article.get('description', '')}" for article in news_articles
    ).lower()
    positive_terms = ["growth", "beat", "strong", "bullish", "rally", "up", "record", "surge"]
    negative_terms = ["risk", "down", "weak", "bearish", "fall", "loss", "drop", "decline"]
    score = sum(term in text for term in positive_terms) - sum(term in text for term in negative_terms)
    normalized = 5 + score * 1
    return max(1, min(10, int(normalized)))


def _fallback_summary(query: str, news_articles: list[dict[str, Any]]) -> dict[str, Any]:
    if not news_articles:
        current_market_state = [
            f"No live news items were available for {query} at this time.",
            "Market direction is being inferred from the sector context and existing quote data.",
            "Refresh after the external services are restored to load a live summary.",
        ]
        critical_developments = [
            "NewsAPI/Gemini fallback activated",
        ]
    else:
        current_market_state = []
        critical_developments = []
        for article in news_articles[:3]:
            title = article.get("title", "Headline unavailable")
            source = article.get("source", "Unknown source")
            current_market_state.append(f"{title} ({source})")
            critical_developments.append(title)

        while len(current_market_state) < 3:
            current_market_state.append(f"Live news is currently thin for {query}; monitor for new disclosures.")

    return {
        "current_market_state": current_market_state[:3],
        "critical_developments": critical_developments[:5],
        "sentiment_score": _fallback_sentiment_score(news_articles),
    }


def _build_prompt(query: str, news_articles: list[dict[str, Any]], view_mode: str) -> str:
    safe_query = query.replace("\r", " ").replace("\n", " ").strip()
    news_context = _compact_news_context(news_articles)
    return f"""
Analyze the following recent news headlines for {safe_query}. Synthesize the information into two categories. 1. Market State: 3 brief bullet points summarizing the overall sentiment and market positioning. 2. Critical Developments: 3 brief bullet points highlighting specific, impactful company actions or external threats. DO NOT just repeat the headlines. Provide high-level synthesis.

Return the response in a structured JSON format matching this schema:
{{
  "ai_market_state": ["...", "...", "..."],
  "critical_developments": ["...", "...", "..."]
}}
Output JSON only. Do not wrap the response in ```json or any other formatting.

Input news headlines:
{news_context}
""".strip()


def _generate_summary_sync(query: str, news_articles: list[dict[str, Any]], view_mode: str) -> dict[str, Any]:
    settings = get_settings()
    gemini_api_key = str(settings["gemini_api_key"])
    print(f"DEBUG: Key exists: {bool(gemini_api_key)}")

    if not gemini_api_key:
        return {
            "current_market_state": ["AI synthesis temporarily unavailable due to missing API key."],
            "critical_developments": ["AI synthesis temporarily unavailable due to missing API key."],
            "sentiment_score": 5,
            "alerts": [
                Alert(
                    type="warning",
                    title="AI summary unavailable",
                    message="GEMINI_API_KEY is not configured.",
                ).model_dump(),
            ],
        }

    prompt = _build_prompt(query, news_articles, view_mode)

    client = genai.Client(api_key=gemini_api_key)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8), reraise=True)
    def _generate_content_with_retry() -> Any:
        return client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
                system_instruction="You are a senior financial market analyst. Act as a financial analyst.",
            ),
        )

    try:
        response = _generate_content_with_retry()
        print("DEBUG: client.models.generate_content completed")
        raw_text = _strip_code_fences(response.text or "{}")
        parsed = json.loads(raw_text)
        
        ai_market_state = _normalize_string_list(parsed.get("ai_market_state"))
        critical_developments = _normalize_string_list(parsed.get("critical_developments"))
        
        if not ai_market_state:
            ai_market_state = ["AI synthesis temporarily unavailable due to high API load."]
        if not critical_developments:
            critical_developments = ["AI synthesis temporarily unavailable due to high API load."]
            
        return {
            "current_market_state": ai_market_state[:3],
            "critical_developments": critical_developments[:3],
            "sentiment_score": _fallback_sentiment_score(news_articles),
            "alerts": [],
        }
    except Exception as e:
        print(f"Gemini API rate limited or failed: {e}")
        print(f"DEBUG EXCEPTION: {e}")
        return {
            "current_market_state": ["AI synthesis temporarily unavailable due to high API load."],
            "critical_developments": ["AI synthesis temporarily unavailable due to high API load."],
            "sentiment_score": 5,
            "alerts": [
                Alert(
                    type="warning",
                    title="AI summary degraded",
                    message="Gemini returned an error or rate limit. A fallback summary is being shown.",
                ).model_dump(),
            ],
        }


async def generate_ai_summary(query: str, news_articles: list[dict[str, Any]], view_mode: str) -> dict[str, Any]:
    return await asyncio.to_thread(_generate_summary_sync, query, news_articles, view_mode)


def _classify_entity_heuristics(query: str) -> str:
    q = query.lower().strip()
    
    # Common sector keywords
    sector_keywords = {
        "tech", "technology", "software", "biotech", "biotechnology", "semiconductor", "retail", "energy", 
        "real estate", "banking", "financial", "automotive", "healthcare", "pharma", "pharmaceutical", 
        "telecom", "utility", "utilities", "metals", "mining", "chemical", "chemicals", "agriculture", 
        "commodity", "crypto", "cryptocurrency", "gold", "silver", "oil", "gas"
    }
    
    # Check words in query for sectors
    query_words = set(q.split())
    if query_words.intersection(sector_keywords):
        return "SECTOR"
        
    # Clean company words to check for known private entities
    if any(pc in q for pc in ["spacex", "stripe", "bytedance", "openai", "valve", "ikea", "bloomberg"]):
        return "PRIVATE"

    # Yahoo Search Lookup
    quotes = []
    try:
        import requests
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=5&newsCount=0"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        response = requests.get(url, headers=headers, timeout=3)
        if response.ok:
            data = response.json()
            quotes = data.get("quotes", [])
    except Exception:
        pass

    if not quotes:
        # If there are 0 quotes, check if it's likely gibberish or a private company name
        has_vowels = any(char in q for char in "aeiou")
        has_digits = any(char.isdigit() for char in q)
        is_single_word = len(q.split()) == 1
        
        if (is_single_word and (has_digits or not has_vowels)) or len(q) < 2 or len(q) > 40:
            return "INVALID"
        
        return "PRIVATE"

    # We have quotes! Let's check them.
    is_private_derivative = False
    has_standard_equity = False
    
    for quote in quotes:
        shortname = str(quote.get("shortname", "")).lower()
        longname = str(quote.get("longname", "")).lower()
        quote_type = str(quote.get("quoteType", "")).upper()
        
        if "pre-ipo" in shortname or "pre-ipo" in longname or "tokenized" in shortname or "tokenized" in longname or "derivative" in shortname:
            is_private_derivative = True
            
        if quote_type in ["EQUITY", "ETF"]:
            has_standard_equity = True
            
    if is_private_derivative:
        return "PRIVATE"
        
    if has_standard_equity:
        return "PUBLIC"
        
    return "PUBLIC"


@lru_cache(maxsize=128)
def _classify_entity_sync(query: str) -> str:
    # 1. Run heuristics first. If it is PUBLIC or INVALID, return immediately.
    # This prevents making a Gemini API call for standard tickers/queries.
    heuristic_res = _classify_entity_heuristics(query)
    if heuristic_res in ["PUBLIC", "INVALID"]:
        return heuristic_res

    settings = get_settings()
    gemini_api_key = settings.get("gemini_api_key")
    if not gemini_api_key:
        return heuristic_res

    prompt = f"""
Classify the following query into exactly one of these categories: PUBLIC, PRIVATE, SECTOR, or INVALID.

Categories:
- PUBLIC: A publicly traded company or its stock ticker (e.g., Apple, Microsoft, Reliance, Tesla, AAPL, MSFT, Google, GOOGL, NVDA, TCS).
- PRIVATE: A private company, startup, or non-public entity (e.g., SpaceX, Stripe, ByteDance, OpenAI, Valve, IKEA, Bloomberg).
- SECTOR: An economic sector, industry, macro trend, or broad commodity/asset class (e.g., Technology, Biotech, AI, Semiconductor, Software, Real Estate, Banking, Automotive, Gold, Energy, Retail).
- INVALID: Random characters, gibberish, offensive words, completely meaningless inputs, or terms that do not map to any company, sector, or financial entity (e.g., "asdfghjk", "foo", "xyz123").

Query: "{query}"

Output exactly one of the words: PUBLIC, PRIVATE, SECTOR, or INVALID. Output nothing else. No markdown, no punctuation.
""".strip()

    try:
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
            ),
        )
        if response and response.text:
            cleaned_res = response.text.strip().upper()
            cleaned_res = re.sub(r'[^A-Z]', '', cleaned_res)
            if cleaned_res in ["PUBLIC", "PRIVATE", "SECTOR", "INVALID"]:
                print(f"DEBUG: LLM classified '{query}' as {cleaned_res}")
                return cleaned_res
    except Exception as e:
        print(f"Gemini API rate limited or failed: {e}")
        print(f"DEBUG: LLM classification failed for '{query}' -> {e}")

    return _classify_entity_heuristics(query)


def _generate_private_profile_sync(company_name: str) -> dict[str, Any]:
    settings = get_settings()
    gemini_api_key = settings.get("gemini_api_key")
    
    profile = {
        "description": f"Private enterprise profile for {company_name}.",
        "sector": "Private Enterprise",
        "industry": "Unknown",
        "website": None,
        "full_time_employees": None,
    }
    
    if not gemini_api_key:
        return profile

    prompt = f"""
Provide professional details for the private company "{company_name}" in a JSON format matching this schema:
{{
  "description": "A detailed professional one-to-two sentence summary of the company, its business model, and products.",
  "sector": "Sector name",
  "industry": "Industry name",
  "website": "official website URL if known, else null",
  "full_time_employees": number of employees if known, else null
}}
Output JSON only. Do not wrap the response in ```json or any other formatting.
""".strip()

    try:
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json",
            ),
        )
        if response and response.text:
            cleaned_res = _strip_code_fences(response.text)
            parsed = json.loads(cleaned_res)
            return {
                "description": parsed.get("description") or profile["description"],
                "sector": parsed.get("sector") or profile["sector"],
                "industry": parsed.get("industry") or profile["industry"],
                "website": parsed.get("website"),
                "full_time_employees": parsed.get("full_time_employees"),
            }
    except Exception as e:
        print(f"Gemini API rate limited or failed: {e}")
        print(f"DEBUG: Private profile generation failed for '{company_name}' -> {e}")

    return profile


async def classify_entity(query: str) -> str:
    return await asyncio.to_thread(_classify_entity_sync, query)


async def generate_private_company_profile(company_name: str) -> dict[str, Any]:
    return await asyncio.to_thread(_generate_private_profile_sync, company_name)
