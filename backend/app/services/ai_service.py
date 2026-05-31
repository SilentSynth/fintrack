from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from google import genai
from google.genai import types
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.settings import get_settings
from app.schemas import Alert


def _compact_news_context(news_articles: list[dict[str, Any]]) -> str:
    if not news_articles:
        return "No live articles were available."

    lines = []
    for index, article in enumerate(news_articles, start=1):
        title = article.get("title", "Untitled headline")
        description = article.get("description") or ""
        source = article.get("source", "Unknown source")
        lines.append(f"{index}. {title} | {source} | {description}")
    return "\n".join(lines)


def _strip_code_fences(raw_text: str) -> str:
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
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
    news_context = _compact_news_context(news_articles)
    return f"""
You are a senior financial market analyst.

Analyze the following live news items for the query: {query}
Operating mode: {view_mode}

Return STRICT JSON only with this exact shape:
{{
  "current_market_state": ["bullet 1", "bullet 2", "bullet 3"],
  "critical_developments": ["item 1", "item 2", "item 3"],
  "sentiment_score": 7
}}

Rules:
- current_market_state must contain exactly 3 concise bullet strings.
- critical_developments should be a list of the most important developments, grounded in the supplied headlines/snippets.
- sentiment_score must be an integer from 1 to 10.
- Output JSON only.
- Do not include markdown fences, code fences, prose, comments, labels, or any explanatory text.
- Do not wrap the response in ```json or any other markdown formatting.
- Return raw JSON that can be parsed directly by json.loads.

Live news input:
{news_context}
""".strip()


def _generate_summary_sync(query: str, news_articles: list[dict[str, Any]], view_mode: str) -> dict[str, Any]:
    settings = get_settings()
    gemini_api_key = str(settings["gemini_api_key"])
    print(f"DEBUG: Key exists: {bool(gemini_api_key)}")

    if not gemini_api_key:
        fallback = _fallback_summary(query, news_articles)
        fallback["alerts"] = [
            Alert(
                type="warning",
                title="AI summary unavailable",
                message="GEMINI_API_KEY is not configured. Showing a deterministic fallback summary.",
            ).model_dump(),
        ]
        return fallback

    prompt = _build_prompt(query, news_articles, view_mode)

    client = genai.Client(api_key=gemini_api_key)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=8), reraise=True)
    def _generate_content_with_retry() -> Any:
        return client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.2,
                response_mime_type="application/json",
            ),
        )

    try:
        response = _generate_content_with_retry()
        raw_text = _strip_code_fences(response.text or "{}")
        parsed = json.loads(raw_text)
    except Exception as e:
        print(f"CRITICAL GEMINI ERROR: {str(e)}")
        fallback = _fallback_summary(query, news_articles)
        fallback["alerts"] = [
            Alert(
                type="warning",
                title="AI summary degraded",
                message="Gemini returned an error or rate limit. A fallback summary is being shown.",
            ).model_dump(),
        ]
        return fallback

    return {
        "current_market_state": _normalize_string_list(parsed.get("current_market_state"), desired_length=3)[:3]
        or _fallback_summary(query, news_articles)["current_market_state"],
        "critical_developments": _normalize_string_list(parsed.get("critical_developments")),
        "sentiment_score": max(1, min(10, int(parsed.get("sentiment_score", 5)))),
        "alerts": [],
    }


async def generate_ai_summary(query: str, news_articles: list[dict[str, Any]], view_mode: str) -> dict[str, Any]:
    return await asyncio.to_thread(_generate_summary_sync, query, news_articles, view_mode)
