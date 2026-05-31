from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class Alert(BaseModel):
    type: Literal["info", "warning", "error"]
    title: str
    message: str


class StockData(BaseModel):
    query: str
    ticker: str | None = None
    company_name: str | None = None
    current_price: float | None = None
    market_cap: int | None = None
    currency: str = "USD"
    has_live_quote: bool = False
    view_mode: Literal["ticker", "macro_sector"] = "ticker"


class HistoricalPrice(BaseModel):
    date: str
    close: float


class NewsArticle(BaseModel):
    title: str
    url: str
    source: str
    published_at: str
    description: str | None = None


class AiSummary(BaseModel):
    current_market_state: list[str] = Field(default_factory=list)
    critical_developments: list[str] = Field(default_factory=list)
    sentiment_score: int = 5


class InsightsResponse(BaseModel):
    query: str
    view_mode: Literal["ticker", "macro_sector"]
    stock_data: StockData
    historical_prices: list[HistoricalPrice] = Field(default_factory=list)
    news_articles: list[NewsArticle] = Field(default_factory=list)
    ai_summary: AiSummary
    alerts: list[Alert] = Field(default_factory=list)
