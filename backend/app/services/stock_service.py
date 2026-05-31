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
            current_price = meta.get("regularMarketPrice")
            
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

    return {
        "query": query,
        "ticker": query if has_live_quote else None,
        "current_price": current_price,
        "market_cap": market_cap,
        "currency": currency_code,
        "currency_symbol": currency_symbol, 
        "historical_prices": historical_prices, 
        "has_live_quote": has_live_quote,
        "view_mode": view_mode
    }

async def fetch_stock_snapshot(query: str) -> dict:
    return await asyncio.to_thread(_fetch_stock_sync, query)