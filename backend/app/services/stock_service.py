import requests
import asyncio
from datetime import datetime


YAHOO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}


def _resolve_ticker(query: str) -> str:
    query = query.strip()

    try:
        url = f"https://query2.finance.yahoo.com/v1/finance/search?q={query}&quotesCount=1&newsCount=0"
        response = requests.get(url, headers=YAHOO_HEADERS, timeout=5)
        data = response.json()

        quotes = data.get("quotes", []) if isinstance(data, dict) else []
        if quotes:
            symbol = quotes[0].get("symbol")
            if symbol:
                return symbol
    except Exception as e:
        print(f"DEBUG: Ticker resolution failed for {query} -> {e}")

    return query

def _fetch_asset_profile(ticker: str) -> dict:
    from app.core.settings import get_settings
    settings = get_settings()
    fmp_api_key = settings.get("fmp_api_key")
    
    if fmp_api_key:
        try:
            print(f"DEBUG: Fetching profile summary via FMP for {ticker}...")
            url = f"https://financialmodelingprep.com/api/v3/profile/{ticker}?apikey={fmp_api_key}"
            response = requests.get(url, timeout=2.5)
            if response.ok:
                profile_list = response.json()
                if isinstance(profile_list, list) and len(profile_list) > 0:
                    profile_data = profile_list[0]
                    return {
                        "description": profile_data.get("description"),
                        "sector": profile_data.get("sector"),
                        "industry": profile_data.get("industry"),
                        "website": profile_data.get("website"),
                        "full_time_employees": profile_data.get("fullTimeEmployees"),
                        "currency": profile_data.get("currency"),
                    }
        except Exception as e:
            print(f"DEBUG: FMP profile fetch failed for {ticker} -> {e}")

    try:
        print(f"DEBUG: Fetching profile summary via yfinance for {ticker}...")
        import yfinance as yf
        t = yf.Ticker(ticker)
        info = t.info
        if info:
            return {
                "description": info.get("longBusinessSummary") or info.get("description"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "website": info.get("website"),
                "full_time_employees": info.get("fullTimeEmployees"),
                "currency": info.get("currency"),
            }
    except Exception as e:
        print(f"DEBUG: Asset profile fetch failed for {ticker} -> {e}")
    return {}

def _generate_one_sentence_summary(ticker: str) -> str | None:
    from app.core.settings import get_settings
    from google import genai
    
    settings = get_settings()
    gemini_api_key = settings.get("gemini_api_key")
    if not gemini_api_key:
        return None
        
    try:
        print(f"DEBUG: Generating AI fallback description for {ticker}...")
        client = genai.Client(api_key=gemini_api_key)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Write a very brief, professional one-sentence company summary for the stock ticker or name '{ticker}'. Do not include markdown or formatting, just return the plain text sentence.",
        )
        if response and response.text:
            return response.text.strip()
    except Exception as e:
        print(f"DEBUG: AI fallback description generation failed for {ticker} -> {e}")
    return None

def _fetch_stock_sync(query: str) -> dict:
    query = _resolve_ticker(query)
    query = query.upper().strip()
    url = f"https://query2.finance.yahoo.com/v8/finance/chart/{query}?interval=1d&range=1mo"
    
    current_price = None
    market_cap = None
    historical_prices = []
    
    is_indian = ".NS" in query or ".BO" in query
    currency_code = "INR" if is_indian else "USD"
    currency_symbol = "₹" if is_indian else "$"
    
    try:
        print(f"DEBUG: Fetching raw data and history for {query}...")
        response = requests.get(url, headers=YAHOO_HEADERS, timeout=5)
        data = response.json()
        
        result = data.get("chart", {}).get("result", [])
        if result:
            meta = result[0].get("meta", {})
            raw_price = meta.get("regularMarketPrice")
            prev_close = meta.get("previousClose") or meta.get("chartPreviousClose") or meta.get("regularMarketPreviousClose")
            current_price = raw_price if (raw_price and raw_price != 0) else prev_close
            
            timestamps = result[0].get("timestamp", [])
            indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
            closes = indicators.get("close", [])
            
            for i in range(len(timestamps)):
                if closes[i] is not None:
                    date_str = datetime.fromtimestamp(timestamps[i]).strftime('%Y-%m-%d')
                    historical_prices.append({
                        "date": date_str,
                        "price": round(closes[i], 2),
                        "close": round(closes[i], 2)
                    })
                    
            print(f"DEBUG: Found price! -> {current_price}. Packed {len(historical_prices)} historical data points.")
        else:
            print(f"DEBUG: Yahoo returned empty results. Error: {data.get('chart', {}).get('error')}")

    except Exception as e:
        print(f"DEBUG: HTTP Request failed -> {e}")

    has_live_quote = current_price is not None
    view_mode = "ticker" if has_live_quote else "macro_sector"
    
    market_state = ""
    if result:
        meta = result[0].get("meta", {})
        market_state = str(meta.get("marketState", "")).upper()
    is_market_open = (market_state == "REGULAR")

    # Fetch asset profile and setup fallbacks
    profile = _fetch_asset_profile(query)
    description = profile.get("description")
    sector = profile.get("sector")
    industry = profile.get("industry")
    website = profile.get("website")
    full_time_employees = profile.get("full_time_employees")
    profile_currency = profile.get("currency")
    
    if profile_currency:
        currency_code = profile_currency
        currency_symbol = "₹" if currency_code == "INR" else ("$" if currency_code == "USD" else currency_code)

    if not description:
        description = _generate_one_sentence_summary(query)

    return {
        "query": query,
        "ticker": query if has_live_quote else None,
        "current_price": current_price,
        "market_cap": market_cap,
        "currency": currency_code,
        "currency_symbol": currency_symbol, 
        "historical_prices": historical_prices, 
        "has_live_quote": has_live_quote,
        "is_market_open": is_market_open,
        "view_mode": view_mode,
        "description": description,
        "sector": sector,
        "industry": industry,
        "website": website,
        "full_time_employees": full_time_employees
    }

async def fetch_stock_snapshot(query: str) -> dict:
    return await asyncio.to_thread(_fetch_stock_sync, query)
    return await asyncio.to_thread(_fetch_stock_sync, query)