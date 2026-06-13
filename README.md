Markdown
# FinTrack: Financial Intelligence Dashboard

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://fintrack-rho-gules.vercel.app/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-61DAFB?logo=react)](https://react.dev/)

**Live Demo:** [fintrack-rho-gules.vercel.app](https://fintrack-rho-gules.vercel.app/)

FinTrack is a full-stack financial intelligence application that surfaces live market context, recent headlines, and AI-generated market summaries for any stock ticker. It utilizes a secure, server-side architecture to aggregate data from multiple financial and news APIs into a single, cohesive dashboard.

## Core Features

* **Real-Time Market Data:** Fetches live stock prices and historical chart data using Financial Modeling Prep (FMP) with a robust `yfinance` fallback pipeline.
* **AI Market Summaries:** Integrates Google's `gemini-2.5-flash-lite` model on the backend to synthesize live news and profile data into instant, readable market state analysis.
* **Aggregated Financial News:** Pulls the latest, most relevant articles via NewsAPI for the searched ticker.
* **Secure Server-Side Architecture:** A completely "dumb" frontend ensures zero API key leakage. All third-party data requests and rate-limit handling occur invisibly on the FastAPI backend.
* **Premium UI/UX:** Built with React, Tailwind CSS, and Recharts, featuring a dynamic animated WebGL background on the landing page and isolated error boundaries for bulletproof rendering.

## Tech Stack

* **Frontend:** React, Vite, Tailwind CSS, Recharts, Framer Motion
* **Backend:** Python, FastAPI, Uvicorn, yfinance
* **AI Integration:** Google GenAI SDK (`gemini-2.5-flash-lite`)
* **External APIs:** Financial Modeling Prep (FMP), NewsAPI
* **Deployment:** Vercel (Monorepo Configuration)

## Directory Layout

```text
fintrack/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── insights.py       # Main /api/insights/{query} router
│   │   ├── services/
│   │   │   ├── stock_service.py  # FMP & yfinance market data service
│   │   │   ├── news_service.py   # NewsAPI integration via httpx
│   │   │   └── ai_service.py     # Gemini summarization service
│   │   └── main.py               # FastAPI app bootstrap and CORS setup
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   └── components/
│   │       ├── Dashboard.jsx     # Main dashboard UI
│   │       └── ColorBends.jsx    # Animated landing page background
│   └── package.json
├── vercel.json                   # Vercel monorepo & serverless configuration
└── .gitignore                    # Global security policies
Local Development Setup
1. Clone the repository
Bash
git clone [https://github.com/yourusername/fintrack.git](https://github.com/yourusername/fintrack.git)
cd fintrack
2. Backend Setup
Navigate to the backend folder, install dependencies, and configure your keys.

Bash
cd backend
pip install -r requirements.txt
Create a .env file inside the backend directory:

Code snippet
FMP_API_KEY=your_fmp_api_key_here
NEWS_API_KEY=your_newsapi_key_here
GEMINI_API_KEY=your_gemini_api_key_here
Run the FastAPI server:

Bash
uvicorn app.main:app --reload
The backend will run on http://127.0.0.1:8000

3. Frontend Setup
Open a new terminal window, navigate to the frontend folder, and start the Vite development server.

Bash
cd frontend
npm install
npm run dev
The frontend will run on http://localhost:5173

Security & Deployment
This project is configured as a monorepo for Vercel.

API keys must be injected directly into the Vercel Project Settings (Environment Variables).

The root vercel.json dictates the execution timeouts and routing for the serverless Python functions.

The .gitignore globally blocks .env files from being pushed to version control.

Developed by Hrishikesh D. Nayak
