# FinTrack

**FinTrack** is a full-stack financial intelligence dashboard designed to give investors and analysts a comprehensive, real-time snapshot of any publicly traded company. By aggregating live market data, recent headlines, and AI-driven analysis into a single interface, FinTrack eliminates the need to jump between multiple financial platforms to understand a stock's current market state.

## Demo & Screenshots

**Live Demo Video:**
*(Drag and drop your .mp4 video file here via the GitHub web editor, or replace this text with a YouTube/Loom link)*

**Landing Page:**
![Landing Page Screenshot]
<img width="1917" height="900" alt="image" src="https://github.com/user-attachments/assets/c05ef0ed-cdf3-4716-9c9b-25d7639bcea6" />

**Dashboard Preview:**
![Dashboard Screenshots]
<img width="1890" height="911" alt="image" src="https://github.com/user-attachments/assets/66fe712b-cf2a-4ef7-933f-fd8aa5c59745" />
<img width="1892" height="831" alt="image" src="https://github.com/user-attachments/assets/ce58b562-7bce-437a-a671-2cc383b7876e" />
<img width="1883" height="900" alt="image" src="https://github.com/user-attachments/assets/1ac52598-b388-4dd6-b498-dcab658da585" />

---

## Key Functionalities & Uses

* **Real-Time Market Telemetry:** Fetches and displays live stock prices, volume, and core company metrics instantly using Financial Modeling Prep (FMP) and `yfinance`.
* **AI-Powered Market Summaries:** Leverages Google's `gemini-2.5-flash-lite` model to analyze current market conditions, synthesizing raw data and recent news into digestible, actionable insights.
* **Aggregated News Feed:** Pulls the most recent and relevant financial articles via NewsAPI, keeping users updated on press releases and macro-economic shifts affecting their targeted stock.
* **Secure, Serverless Architecture:** Built on a decoupled monorepo architecture where the Python backend handles all heavy lifting and API key security, passing clean, formatted data to a lightweight, responsive React frontend.
* **Dynamic Visuals:** Features an interactive Dashboard for data visualization and a premium, animated WebGL/Canvas background on the landing page for a modern user experience.

## Directory Layout

A clean separation of concerns between the FastAPI backend and the React/Vite frontend.

```text
fintrack/
├── backend/                              # Python Serverless Backend
│   ├── app/
│   │   ├── api/
│   │   │   └── insights.py               # Main API router for /api/insights/{query}
│   │   ├── services/
│   │   │   ├── stock_service.py          # FMP & yfinance market data aggregation
│   │   │   ├── news_service.py           # NewsAPI HTTP client integration
│   │   │   └── ai_service.py             # Gemini LLM summarization logic
│   │   └── main.py                       # FastAPI application bootstrap & CORS
│   ├── requirements.txt                  # Python dependencies
│   └── .env                              # Secure backend environment variables
│
├── frontend/                             # React + Vite Client
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard.jsx             # Main interactive data display
│   │   │   └── ColorBends.jsx            # Animated landing page background
│   │   ├── App.jsx                       # Root application component
│   │   └── main.jsx                      # React DOM entry point
│   ├── package.json                      # Node dependencies
│   └── vite.config.js                    # Vite bundler configuration
│
├── vercel.json                           # Monorepo routing & execution limits
└── .gitignore                            # Global security & environment protections
```

## Local Development Setup



Clone the repository:



```bash

git clone [https://github.com/yourusername/fintrack.git](https://github.com/yourusername/fintrack.git)

cd fintrack
```



## Backend



Install dependencies:



```bash

pip install -r backend/requirements.txt

```



Configure environment variables in `backend/.env`:



```env

Create a .env file inside the backend/ directory.

FMP_API_KEY=your_fmp_api_key_here
NEWS_API_KEY=your_newsapi_key_here
GEMINI_API_KEY=your_gemini_api_key_here

```



Run the API from the backend folder:



```bash

cd backend

uvicorn app.main:app --reload

```



## Frontend



Install dependencies:



```bash

cd frontend

npm install

```



Run the app:



```bash

npm run dev

```

