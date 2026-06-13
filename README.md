# fintrack



Financial Intelligence Dashboard for live stock data, recent news, and Gemini-generated market summaries.



## Directory Layout



- `backend/app/main.py` - FastAPI app bootstrap and CORS setup

- `backend/app/api/insights.py` - `/api/insights/{query}` router

- `backend/app/services/stock_service.py` - Financial Modeling Prep market data service

- `backend/app/services/news_service.py` - NewsAPI integration via httpx

- `backend/app/services/ai_service.py` - Gemini summarization service

- `frontend/src/components/Dashboard.jsx` - main dashboard UI



## Backend



Install dependencies:



```bash

pip install -r backend/requirements.txt

```



Configure environment variables in `backend/.env`:



```env

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

