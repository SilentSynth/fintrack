import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import Orb from './Orb';
import ColorBends from './ColorBends';
import TiltedCard from './TiltedCard';

const API_BASE_URL = import.meta.env.PROD ? "" : "http://localhost:8000";
const RECENT_SEARCHES_STORAGE_KEY = 'fintrack.recentSearches';
const CURRENCY_SYMBOLS = { USD: '$', INR: '₹', EUR: '€', GBP: '£' };
const RECENT_SEARCHES_ENABLED_STORAGE_KEY = 'fintrack.recentSearchesEnabled';

const NEWS_IMAGES = [
  'https://images.unsplash.com/photo-1518655048521-f130df041f66?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=800&q=80',
];

function formatMarketCap(value, currencySymbol = '') {
  if (value === null || value === undefined) {
    return 'N/A';
  }

  const absValue = Math.abs(value);
  if (absValue >= 1_000_000_000_000) return `${currencySymbol}${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (absValue >= 1_000_000_000) return `${currencySymbol}${(value / 1_000_000_000).toFixed(2)}B`;
  if (absValue >= 1_000_000) return `${currencySymbol}${(value / 1_000_000).toFixed(2)}M`;
  return `${currencySymbol}${value.toLocaleString()}`;
}

function toBulletList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((item) => item.replace(/^[-*•\s]+/, '').trim())
      .filter(Boolean);
  }

  return [];
}

function sentimentDetails(score) {
  const numericScore = Number(score) || 5;

  if (numericScore >= 7) {
    return {
      label: 'Bullish',
      tone: 'green',
      description: 'Bullish 7-10',
      barClass: 'bg-emerald-400',
      badgeClass: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
      fillClass: 'bg-emerald-400',
    };
  }

  if (numericScore >= 4) {
    return {
      label: 'Neutral',
      tone: 'yellow',
      description: 'Neutral 4-6',
      barClass: 'bg-amber-400',
      badgeClass: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
      fillClass: 'bg-amber-400',
    };
  }

  return {
    label: 'Bearish',
    tone: 'red',
    description: 'Bearish 1-3',
    barClass: 'bg-rose-400',
    badgeClass: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    fillClass: 'bg-rose-400',
  };
}

function normalizeSentiment(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return 5;
  }

  return Math.min(10, Math.max(1, Math.round(numericScore)));
}

function SkeletonCard({ className = '', children }) {
  return (
    <div className={`animate-pulse rounded-3xl border border-white/10 bg-white/5 p-6 ${className}`}>{children}</div>
  );
}

function SummarySkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-32 rounded-full bg-slate-800" />
      <div className="h-8 w-56 rounded-full bg-slate-800" />
      <div className="space-y-3 rounded-2xl bg-slate-900/70 p-4">
        <div className="h-3 w-40 rounded-full bg-slate-800" />
        <div className="h-3 w-full rounded-full bg-slate-800" />
        <div className="h-3 w-5/6 rounded-full bg-slate-800" />
        <div className="h-3 w-3/4 rounded-full bg-slate-800" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 rounded-2xl bg-slate-900/70" />
        <div className="h-24 rounded-2xl bg-slate-900/70" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-4 w-40 rounded-full bg-slate-800" />
      <div className="h-8 w-56 rounded-full bg-slate-800" />
      <div className="h-80 rounded-2xl bg-slate-900/70" />
    </div>
  );
}

function NewsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5 overflow-hidden w-full max-w-full animate-pulse"
        >
          <div className="h-3 w-1/4 rounded-full bg-slate-800" />
          <div className="h-5 w-5/6 rounded-full bg-slate-800" />
          <div className="h-5 w-3/4 rounded-full bg-slate-800" />
          <div className="space-y-2">
            <div className="h-3 w-5/6 rounded-full bg-slate-800" />
            <div className="h-3 w-2/3 rounded-full bg-slate-800" />
            <div className="h-3 w-1/2 rounded-full bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AiSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* AI Market State Section Skeleton */}
      <div>
        <div className="h-4 w-1/4 bg-zinc-800 rounded mb-5" />
        <div className="space-y-3">
          <div className="h-3 w-full bg-zinc-800/60 rounded" />
          <div className="h-3 w-11/12 bg-zinc-800/60 rounded" />
          <div className="h-3 w-4/5 bg-zinc-800/60 rounded" />
        </div>
      </div>

      {/* Critical Developments Section Skeleton */}
      <div>
        <div className="h-4 w-1/4 bg-zinc-800 rounded mb-5" />
        <div className="space-y-3">
          <div className="h-3 w-full bg-zinc-800/60 rounded" />
          <div className="h-3 w-5/6 bg-zinc-800/60 rounded" />
          <div className="h-3 w-11/12 bg-zinc-800/60 rounded" />
        </div>
      </div>
    </div>
  );
}

function AlertBanner({ alert }) {
  const toneClass =
    alert.type === 'error'
      ? 'border-rose-500/30 bg-rose-500/10 text-rose-100'
      : alert.type === 'warning'
        ? 'border-amber-500/30 bg-amber-500/10 text-amber-50'
        : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-50';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      <div className="font-semibold">{alert.title}</div>
      <div className="mt-1 leading-6 text-slate-200">{alert.message}</div>
    </div>
  );
}

function NewsCard({ article }) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noreferrer"
      className="group block border-b border-white/5 py-4 transition hover:opacity-80"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
        <p className="uppercase tracking-[0.3em]">{article.source}</p>
        <span>{article.published_at?.slice(0, 10)}</span>
      </div>
      <h3 className="mt-3 text-base font-medium leading-7 text-slate-50">{article.title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-400">{article.description || 'Open to read the full article.'}</p>
    </a>
  );
}

function getArticleImageSrc(article, index) {
  return (
    article.image_url ||
    article.imageUrl ||
    article.url_to_image ||
    article.urlToImage ||
    article.image ||
    FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]
  );
}

function getArticleOverlayText(article) {
  return article.description || 'Open the article for the full story.';
}

function formatChartDate(value) {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsedDate);
}

function ChartTooltip({ active, payload, currencySymbol }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0]?.payload || {};
  const price = Number(point.price ?? payload[0]?.value);

  if (!Number.isFinite(price)) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-[#040507]/90 px-3 py-2 text-xs text-slate-100 shadow-2xl backdrop-blur">
      <div className="text-slate-500">{formatChartDate(point.date)}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-white">
        {currencySymbol}
        {price.toFixed(2)}
      </div>
    </div>
  );
}

function SearchBar({
  query,
  setQuery,
  onSubmit,
  loading,
  recentSearchesEnabled,
  handleRecentSearchToggle,
  recentSearches,
  handleRecentSearchClick,
  align = 'center',
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <div className={`w-full ${align === 'center' ? 'max-w-xl mx-auto' : 'max-w-xl'}`}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div
          className={`flex items-center gap-3 rounded-lg border transition-all duration-300 px-4 py-2.5 shadow-2xl shadow-black/30 backdrop-blur-md ${isFocused
            ? 'border-slate-500/50 shadow-[0_0_20px_rgba(100,116,139,0.15)] bg-white/10'
            : 'border-white/10 bg-white/8'
            }`}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search ticker, company, or sector"
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500 py-1"
          />
          <button
            type="submit"
            className="bg-slate-700 shadow-[0_0_15px_rgba(100,116,139,0.2)] hover:bg-slate-600 hover:scale-105 hover:shadow-[0_0_25px_rgba(100,116,139,0.4)] transition-all duration-300 text-white font-semibold rounded-md px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-70 flex items-center gap-1.5 shrink-0"
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Analyzing
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Analyze
              </>
            )}
          </button>
        </div>
      </form>

      <div className={`mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-300 ${align === 'center' ? 'justify-center' : 'justify-start'}`}>
        <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-400 text-sm">
          <div className="relative">
            <input
              type="checkbox"
              checked={recentSearchesEnabled}
              onChange={handleRecentSearchToggle}
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded border transition-all duration-200 flex items-center justify-center ${recentSearchesEnabled
                ? 'bg-slate-700 border-slate-600 shadow-[0_0_10px_rgba(100,116,139,0.3)]'
                : 'bg-zinc-900/50 border-zinc-700/80 hover:border-zinc-500'
                }`}
            >
              {recentSearchesEnabled && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
          <span>Recent searches</span>
        </label>

        {recentSearchesEnabled && recentSearches.length > 0
          ? recentSearches.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleRecentSearchClick(item)}
              className="bg-zinc-900/50 border border-zinc-700/80 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-300 text-sm px-3 py-1 rounded-full transition-colors cursor-pointer"
            >
              {item}
            </button>
          ))
          : null}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSearchesEnabled, setRecentSearchesEnabled] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);
  const [aiSummaryData, setAiSummaryData] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [isStockDataLoading, setIsStockDataLoading] = useState(true);
  const [showCompanyInfo, setShowCompanyInfo] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [shuffledNewsImages, setShuffledNewsImages] = useState(() =>
    [...NEWS_IMAGES].sort(() => Math.random() - 0.5)
  );

  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleCardMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Calculate cursor position relative to card center (ranging from -0.5 to 0.5)
    const x = e.clientX - rect.left - width / 2;
    const y = e.clientY - rect.top - height / 2;

    // Max rotation amplitude in degrees
    const maxRotate = 8;

    // Calculate rotate angles (rotateY uses x coordinate, rotateX uses y coordinate)
    const rX = -(y / (height / 2)) * maxRotate;
    const rY = (x / (width / 2)) * maxRotate;

    setTilt({ x: rX, y: rY });
    setIsHovered(true);
  };

  const handleCardMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  const tiltStyle = {
    perspective: '1000px',
    transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) scale3d(${isHovered ? 1.01 : 1}, ${isHovered ? 1.01 : 1}, 1)`,
    transition: isHovered
      ? 'transform 0.1s cubic-bezier(0.25, 1, 0.5, 1)'
      : 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)',
    transformStyle: 'preserve-3d',
  };

  const pollPrice = useCallback(async (nextQuery) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/insights/${encodeURIComponent(nextQuery)}`);
      if (response.ok) {
        const payload = await response.json().catch(() => null);
        if (payload && payload.stock_data) {
          const newPrice = payload.stock_data.current_price;
          if (newPrice !== 0 && newPrice !== null && newPrice !== undefined) {
            setData(payload);
          }
        }
      }
    } catch (pollError) {
      console.error('Silent background poll failed:', pollError);
    }
  }, []);

  useEffect(() => {
    if (!submittedQuery || !data?.stock_data?.has_live_quote || !data?.stock_data?.is_market_open) {
      return;
    }

    const intervalId = setInterval(() => {
      pollPrice(submittedQuery);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [submittedQuery, data?.stock_data?.has_live_quote, data?.stock_data?.is_market_open, pollPrice]);

  useEffect(() => {
    if (submittedQuery) {
      const shuffled = [...NEWS_IMAGES].sort(() => Math.random() - 0.5);
      setShuffledNewsImages(shuffled);
    }
  }, [submittedQuery]);

  useEffect(() => {
    // 1. Load recent searches settings
    const storedEnabled = localStorage.getItem(RECENT_SEARCHES_ENABLED_STORAGE_KEY);
    const enabled = storedEnabled === null ? true : storedEnabled === 'true';
    setRecentSearchesEnabled(enabled);

    if (enabled) {
      try {
        const storedSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY) || '[]');
        if (Array.isArray(storedSearches)) {
          setRecentSearches(storedSearches);
        }
      } catch {
        setRecentSearches([]);
      }
    }

    // 2. Parse initial query from URL search parameters on page mount
    const params = new URLSearchParams(window.location.search);
    const urlQuery = params.get('query') || '';
    const trimmed = urlQuery.trim();

    if (trimmed) {
      setSubmittedQuery(trimmed);
      setQuery(trimmed);
      setIsStockDataLoading(true);
      setAiLoading(true);
      runSearch(trimmed);
    } else {
      setIsStockDataLoading(false);
    }

    // 3. Listen to popstate for browser back/forward navigation
    function handlePopState() {
      const currentParams = new URLSearchParams(window.location.search);
      const popQuery = currentParams.get('query') || '';
      const trimmedPop = popQuery.trim();

      setSubmittedQuery(trimmedPop);
      setQuery(trimmedPop);

      if (trimmedPop) {
        setIsStockDataLoading(true);
        setAiLoading(true);
        runSearch(trimmedPop);
      } else {
        setData(null);
        setAiSummaryData(null);
        setIsStockDataLoading(false);
        setAiLoading(false);
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    localStorage.setItem(RECENT_SEARCHES_ENABLED_STORAGE_KEY, String(recentSearchesEnabled));

    if (!recentSearchesEnabled) {
      localStorage.removeItem(RECENT_SEARCHES_STORAGE_KEY);
      setRecentSearches([]);
      return;
    }

    localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(recentSearches.slice(0, 5)));
  }, [recentSearches, recentSearchesEnabled]);

  async function runSearch(nextQuery) {
    setError('');
    setData(null);
    setAiSummaryData(null);
    setIsStockDataLoading(true);
    setAiLoading(true);
    setShowCompanyInfo(false);
    setIsDescriptionExpanded(false);

    try {
      // 1. Fetch telemetry/chart data first
      const response = await fetch(`${API_BASE_URL}/api/insights/${encodeURIComponent(nextQuery)}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.detail || `Request failed with status ${response.status}`);
      }

      setData(payload);
      setIsStockDataLoading(false);

      // 2. Fetch AI analysis summary in background
      try {
        const aiResponse = await fetch(`${API_BASE_URL}/api/insights/${encodeURIComponent(nextQuery)}/summary`);
        const aiPayload = await aiResponse.json().catch(() => null);

        if (!aiResponse.ok) {
          throw new Error(aiPayload?.detail || 'Failed to fetch AI summary.');
        }

        setAiSummaryData(aiPayload);
      } catch (aiError) {
        console.error('AI summary fetch failed:', aiError);
        setAiSummaryData({
          current_market_state: ['AI summary unavailable due to a connection or rate limit issue.'],
          critical_developments: ['Please try again later.'],
          sentiment_score: 5
        });
      } finally {
        setAiLoading(false);
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard data.');
      setData(null);
      setIsStockDataLoading(false);
      setAiLoading(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(event) {
    event.preventDefault();

    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setError('Enter a company name, ticker, or sector query.');
      return;
    }

    // Instantly transition state
    setSubmittedQuery(trimmedQuery);
    setIsStockDataLoading(true);
    setAiLoading(true);
    setLoading(true);

    // Navigate/update browser history instantly
    window.history.pushState({}, '', '?query=' + encodeURIComponent(trimmedQuery));

    if (recentSearchesEnabled) {
      setRecentSearches((currentSearches) => {
        const nextSearches = [trimmedQuery, ...currentSearches.filter((item) => item.toLowerCase() !== trimmedQuery.toLowerCase())];
        return nextSearches.slice(0, 5);
      });
    }

    // Do NOT await, execute search asynchronously
    runSearch(trimmedQuery);
  }

  const chartData = useMemo(() => {
    return (data?.historical_prices ?? [])
      .map((item) => ({
        date: item.date,
        price: Number(item.price ?? item.close),
        close: item.close !== undefined ? Number(item.close) : undefined,
      }))
      .filter((item) => item.date && Number.isFinite(item.price));
  }, [data]);

  const stockData = data?.stock_data ?? {};
  const isDelayed = useMemo(() => {
    if (!stockData.ticker) return false;
    const tickerUpper = stockData.ticker.toUpperCase();
    return (
      tickerUpper.includes('.NS') ||
      tickerUpper.includes('.BO') ||
      (stockData.currency && stockData.currency !== 'USD')
    );
  }, [stockData.ticker, stockData.currency]);

  const displayCurrency = stockData.currency || 'USD';
  const currencySymbol = CURRENCY_SYMBOLS[displayCurrency] || displayCurrency;
  const heroTicker = stockData.ticker || submittedQuery || query || 'Search a stock';
  const currentPriceValue = Number(stockData.current_price);
  const hideHeroPrice =
    stockData.current_price === null ||
    stockData.current_price === undefined ||
    currentPriceValue === 0 ||
    stockData.current_price === 'N/A';
  const hasValidPrice =
    stockData.has_live_quote &&
    stockData.current_price !== null &&
    stockData.current_price !== undefined &&
    currentPriceValue !== 0 &&
    !Number.isNaN(currentPriceValue);
  const firstHistoricalPrice = Number(chartData[0]?.price);
  const isPriceUp =
    Number.isFinite(currentPriceValue) && Number.isFinite(firstHistoricalPrice)
      ? currentPriceValue > firstHistoricalPrice
      : true;
  const themeColor = isPriceUp ? '#00C805' : '#FF5000';
  const gradientId = isPriceUp ? 'chart-gradient-up' : 'chart-gradient-down';
  const currentPriceLabel =
    stockData.current_price !== null && stockData.current_price !== undefined
      ? `${currencySymbol}${Number(stockData.current_price).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
      : '—';
  const aiSummary = aiSummaryData || data?.ai_summary || {};
  const currentMarketState = toBulletList(aiSummary.current_market_state);
  const criticalDevelopments = toBulletList(aiSummary.critical_developments);
  const sentimentScore = normalizeSentiment(aiSummary.sentiment_score);
  const sentiment = sentimentDetails(sentimentScore);
  const isMacroSectorView = data?.view_mode === 'macro_sector' || !stockData.has_live_quote;
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];
  const isAnalyzed = Boolean(submittedQuery || data);
  const currentPriceText = Number.isFinite(currentPriceValue)
    ? currentPriceValue.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : '—';

  function handleRecentSearchToggle(event) {
    const enabled = event.target.checked;
    setRecentSearchesEnabled(enabled);

    if (!enabled) {
      setRecentSearches([]);
    }
  }

  function handleRecentSearchClick(item) {
    const trimmed = item.trim();
    setQuery(trimmed);
    setSubmittedQuery(trimmed);
    setIsStockDataLoading(true);
    setAiLoading(true);
    setLoading(true);
    window.history.pushState({}, '', '?query=' + encodeURIComponent(trimmed));
    runSearch(trimmed);
  }

  if (!isAnalyzed) {
    return (
      <div className="relative w-full min-h-screen bg-black overflow-hidden text-slate-100">
        <div className="absolute inset-0 z-0">
          <ColorBends
            colors={["#4a101d", "#241245", "#023c34"]}
            rotation={90}
            speed={0.2}
            scale={1}
            frequency={1}
            warpStrength={1}
            mouseInfluence={1}
            noise={0.15}
            parallax={0.5}
            iterations={1}
            intensity={1.5}
            bandWidth={6}
            transparent
            color="#0b0512"
          />
        </div>

        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 rounded-[2rem] border border-white/10 bg-black/35 p-8 backdrop-blur-xl sm:p-10">
            <div className="space-y-4">
              <p className="text-xl font-black tracking-widest text-emerald-200/70">FINTRACK</p>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400/80">
                Financial Intelligence Dashboard
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Search a ticker, company, or sector to surface live market context, headlines, and AI-generated insights.
              </p>
            </div>

            <SearchBar
              query={query}
              setQuery={setQuery}
              onSubmit={handleSearch}
              loading={loading}
              recentSearchesEnabled={recentSearchesEnabled}
              handleRecentSearchToggle={handleRecentSearchToggle}
              recentSearches={recentSearches}
              handleRecentSearchClick={handleRecentSearchClick}
              align="center"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040507] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          {isStockDataLoading ? (
            <div className="max-w-3xl space-y-8 animate-pulse w-full">
              <div className="space-y-3">
                <p className="text-xl font-black tracking-widest text-slate-300">FINTRACK</p>
                <div className="h-4 w-32 rounded bg-zinc-800" />
              </div>

              <div className="space-y-4">
                <div className="h-6 w-48 rounded bg-zinc-800" />
                <div className="h-16 w-64 rounded bg-zinc-800" />
                <div className="h-4 w-72 rounded bg-zinc-800/60" />
                <div className="h-4 w-28 bg-zinc-800/80 rounded mt-2" />
              </div>
            </div>
          ) : (
            <div className="max-w-3xl space-y-8">
              <div className="space-y-3">
                <p className="text-xl font-black tracking-widest text-slate-300">FINTRACK</p>
                <div className="flex items-center gap-3 text-lg font-medium text-slate-400">
                  <span>Market Trend</span>
                  {stockData.has_live_quote ? <span className="h-px w-10 bg-white/10" /> : null}
                  {stockData.has_live_quote ? <span style={{ color: themeColor }}>{isPriceUp ? 'Uptrend' : 'Downtrend'}</span> : null}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-2xl font-bold tracking-wide text-gray-300">{heroTicker}</p>
                  {stockData.has_live_quote && (
                    <div className="flex items-center gap-2 select-none">
                      {stockData.is_market_open ? (
                        <>
                          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                          <span className="text-xs text-zinc-400 font-medium">Market Open</span>
                        </>
                      ) : (
                        <>
                          <span className="flex h-2 w-2 rounded-full bg-zinc-600"></span>
                          <span className="text-xs text-zinc-500 font-medium">Market Closed</span>
                        </>
                      )}
                    </div>
                  )}
                  {isDelayed && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900/60 text-xs font-medium text-zinc-400 border border-zinc-800/80 backdrop-blur-md shadow-sm">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-500 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-zinc-400"></span>
                      </span>
                      15-Min Delayed
                    </span>
                  )}
                </div>
                {!hideHeroPrice && (
                  !hasValidPrice ? (
                    <div className="text-xl text-zinc-500 font-medium select-none">
                      {!stockData.has_live_quote ? 'N/A' : 'Market Closed'}
                    </div>
                  ) : (
                    <h1 className="text-6xl font-semibold tabular-nums tracking-tight sm:text-7xl lg:text-8xl">
                      <span className="text-3xl sm:text-4xl lg:text-5xl text-zinc-500 font-medium mr-1.5 select-none">{currencySymbol}</span>
                      <span style={{ color: stockData.has_live_quote ? themeColor : '#e2e8f0' }}>{currentPriceText}</span>
                    </h1>
                  )
                )}
                {stockData.company_name ? <p className="max-w-2xl text-lg text-slate-400">{stockData.company_name}</p> : null}
                {stockData.entity_type !== "SECTOR" && (
                  <div className="mt-2">
                    <button
                      onClick={() => setShowCompanyInfo((prev) => !prev)}
                      className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm font-medium focus:outline-none"
                    >
                      <svg
                        className={`h-4 w-4 transform transition-transform duration-200 ${showCompanyInfo ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                      {showCompanyInfo ? 'Hide Company Info' : 'About Company'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="w-full max-w-xl space-y-4 lg:pt-6">
            <SearchBar
              query={query}
              setQuery={setQuery}
              onSubmit={handleSearch}
              loading={loading}
              recentSearchesEnabled={recentSearchesEnabled}
              handleRecentSearchToggle={handleRecentSearchToggle}
              recentSearches={recentSearches}
              handleRecentSearchClick={handleRecentSearchClick}
              align="left"
            />
          </div>
        </header>

        {showCompanyInfo && !isStockDataLoading && stockData.entity_type !== "SECTOR" && (
          <div
            ref={cardRef}
            onMouseMove={handleCardMouseMove}
            onMouseLeave={handleCardMouseLeave}
            style={tiltStyle}
            className="border border-zinc-800/50 bg-zinc-900/30 backdrop-blur-md rounded-lg p-5 mt-4 will-change-transform"
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300 mb-4">Company Profile</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Left Column - Description */}
              <div className="col-span-1 md:col-span-2">
                <p className={`text-zinc-400 text-sm leading-relaxed max-w-4xl ${isDescriptionExpanded ? '' : 'line-clamp-3'}`}>
                  {stockData.description || 'No description available for this entity.'}
                </p>
                {stockData.description && (
                  <div className="mt-3">
                    <button
                      onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors focus:outline-none"
                    >
                      {isDescriptionExpanded ? 'Show less' : 'Read more'}
                    </button>
                  </div>
                )}
              </div>

              {/* Right Column - At a Glance Sidebar */}
              <div className="col-span-1 flex flex-col space-y-4 md:border-l border-zinc-800/50 md:pl-6 pl-0 border-t md:border-t-0 pt-6 md:pt-0">
                <div>
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Sector</span>
                  <span className="text-sm text-zinc-200 font-medium">{stockData.sector || '—'}</span>
                </div>

                <div>
                  <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Industry</span>
                  <span className="text-sm text-zinc-200 font-medium">{stockData.industry || '—'}</span>
                </div>

                {stockData.website && (
                  <div>
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Website</span>
                    <a
                      href={stockData.website.startsWith('http') ? stockData.website : `https://${stockData.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors break-all"
                    >
                      {stockData.website}
                    </a>
                  </div>
                )}

                {stockData.full_time_employees && (
                  <div>
                    <span className="block text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-1">Employees</span>
                    <span className="text-sm text-zinc-200 font-medium">
                      {Number(stockData.full_time_employees).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error ? (
          <div className="mt-8 rounded-2xl border border-rose-500/20 bg-rose-500/8 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {alerts.length > 0 ? (
          <div className="mt-6 space-y-3">
            {alerts.map((alert, index) => (
              <AlertBanner key={`${alert.title}-${index}`} alert={alert} />
            ))}
          </div>
        ) : null}

        <main className="mt-14 space-y-16">
          <section className="space-y-8">
            {isStockDataLoading ? (
              <div className="h-[420px] w-full animate-pulse rounded-[2rem] bg-zinc-900/60 border border-white/5" />
            ) : isMacroSectorView ? (
              <div className="max-w-2xl text-sm leading-6 text-slate-500">
                No direct stock ticker was resolved for this search, so the live chart is hidden. The market summary and news remain available.
              </div>
            ) : loading ? (
              <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
                Loading chart...
              </div>
            ) : chartData.length > 0 ? (
              <div className="relative h-[420px] overflow-hidden">
                <div className="absolute right-4 top-4 z-10 rounded-full bg-zinc-800/80 px-2 py-1 text-xs uppercase tracking-widest text-zinc-400 backdrop-blur-sm">
                  1 month price history
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={themeColor} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={themeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide tick={false} axisLine={false} tickLine={false} />
                    <YAxis domain={["dataMin - 5", "dataMax + 5"]} hide tick={false} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ stroke: themeColor, strokeWidth: 1, strokeDasharray: '4 4' }}
                      content={(props) => <ChartTooltip {...props} currencySymbol={currencySymbol} />}
                    />
                    <Area type="monotone" dataKey="price" stroke="none" fill={`url(#${gradientId})`} isAnimationActive={false} />
                    <Line type="monotone" dataKey="price" stroke={themeColor} strokeWidth={3} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[420px] items-center justify-center text-sm text-slate-500">
                No historical price data available yet...
              </div>
            )}
          </section>

          <section className="max-w-3xl">
            {aiLoading ? (
              <AiSkeleton />
            ) : (
              <div className="space-y-8">
                <div>
                  <p className="text-large uppercase tracking-[0.35em] text-slate-500">AI Market State</p>
                  <ul className="mt-5 space-y-4 text-lg leading-relaxed text-gray-200">
                    {currentMarketState.length > 0 ? (
                      currentMarketState.map((item, index) => (
                        <li key={`${item}-${index}`} className="mb-4 flex gap-3 last:mb-0">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: themeColor }} />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">No summary available.</li>
                    )}
                  </ul>
                </div>

                <div>
                  <p className="text-large uppercase tracking-[0.35em] text-slate-500">Critical Developments</p>
                  <ul className="mt-5 space-y-4 text-lg leading-relaxed text-gray-200">
                    {criticalDevelopments.length > 0 ? (
                      criticalDevelopments.map((item, index) => (
                        <li key={`${item}-${index}`} className="mb-4 flex gap-3 last:mb-0">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-slate-500" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">No critical developments were extracted.</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-large uppercase tracking-[0.35em] text-slate-500">Recent News</p>
                <h2 className="mt-3 text-xl font-medium text-white">Headlines</h2>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {isStockDataLoading ? (
                <NewsSkeleton />
              ) : (data?.news_articles ?? []).length > 0 ? (
                (data?.news_articles ?? []).map((article, index) => (
                  <a
                    key={`${article.title}-${article.published_at}`}
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <TiltedCard
                      imageSrc={
                        article.image_url ||
                        article.imageUrl ||
                        article.url_to_image ||
                        article.urlToImage ||
                        article.image ||
                        ''
                      }
                      fallbackImageSrc={shuffledNewsImages[index % shuffledNewsImages.length]}
                      altText={article.title}
                      captionText={article.title}
                      containerHeight="420px"
                      containerWidth="100%"
                      imageHeight="420px"
                      imageWidth="100%"
                      rotateAmplitude={12}
                      scaleOnHover={1.08}
                      showMobileWarning={false}
                      showTooltip={true}
                      displayOverlayContent={true}
                      overlayContent={
                        <div className="flex h-[420px] w-full flex-col justify-end rounded-[15px] bg-gradient-to-t from-black/85 via-black/30 to-transparent p-5 text-left">
                          <div className="mb-3 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.35em] text-white/70">
                            <span>{article.source}</span>
                            <span>{article.published_at?.slice(0, 10)}</span>
                          </div>
                          <h3 className="text-balance text-lg font-semibold leading-7 text-white">
                            {article.title}
                          </h3>
                          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">
                            {getArticleOverlayText(article)}
                          </p>
                        </div>
                      }
                    />
                  </a>
                ))
              ) : (
                <div className="py-6 text-sm text-slate-500">No live news articles were returned.</div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
