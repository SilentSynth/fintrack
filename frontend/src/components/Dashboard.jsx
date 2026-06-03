import { useEffect, useMemo, useState } from 'react';
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
import Particles from './Particles';
import TiltedCard from './TiltedCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const RECENT_SEARCHES_STORAGE_KEY = 'fintrack.recentSearches';
const RECENT_SEARCHES_ENABLED_STORAGE_KEY = 'fintrack.recentSearchesEnabled';
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1518655048521-f130df041f66?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
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
        <div key={index} className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-5">
          <div className="h-3 w-28 rounded-full bg-slate-800" />
          <div className="h-5 w-full rounded-full bg-slate-800" />
          <div className="h-5 w-5/6 rounded-full bg-slate-800" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded-full bg-slate-800" />
            <div className="h-3 w-11/12 rounded-full bg-slate-800" />
            <div className="h-3 w-4/5 rounded-full bg-slate-800" />
          </div>
        </div>
      ))}
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

export default function Dashboard() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSearchesEnabled, setRecentSearchesEnabled] = useState(true);
  const [recentSearches, setRecentSearches] = useState([]);

  useEffect(() => {
    const storedEnabled = localStorage.getItem(RECENT_SEARCHES_ENABLED_STORAGE_KEY);
    const enabled = storedEnabled === null ? true : storedEnabled === 'true';
    setRecentSearchesEnabled(enabled);

    if (!enabled) {
      setRecentSearches([]);
      return;
    }

    try {
      const storedSearches = JSON.parse(localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY) || '[]');
      if (Array.isArray(storedSearches)) {
        setRecentSearches(storedSearches);
      }
    } catch {
      setRecentSearches([]);
    }
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
    setQuery(nextQuery);
    setLoading(true);
    setError('');
    setData(null);
    setSubmittedQuery('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/insights/${encodeURIComponent(nextQuery)}`);
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.detail || `Request failed with status ${response.status}`);
      }

      setData(payload);
      setSubmittedQuery(nextQuery);

      if (recentSearchesEnabled) {
        setRecentSearches((currentSearches) => {
          const nextSearches = [nextQuery, ...currentSearches.filter((item) => item.toLowerCase() !== nextQuery.toLowerCase())];
          return nextSearches.slice(0, 5);
        });
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard data.');
      setData(null);
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

    await runSearch(trimmedQuery);
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
  const currencySymbol = stockData.currency_symbol || '';
  const heroTicker = stockData.ticker || submittedQuery || query || 'Search a stock';
  const currentPriceValue = Number(stockData.current_price);
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
  const aiSummary = data?.ai_summary ?? {};
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
    setQuery(item);
    runSearch(item);
  }

  if (!isAnalyzed) {
    return (
      <div className="relative w-full h-screen bg-black overflow-hidden text-slate-100">
        <div className="absolute inset-0 z-0">
          <Particles
            particleColors={['#ffffff', '#00C805', '#10b981']}
            particleCount={300}
            particleSpread={10}
            speed={0.12}
            particleBaseSize={100}
            moveParticlesOnHover={true}
            alphaParticles={false}
            disableRotation={false}
            className="h-full w-full"
          />
        </div>

        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col items-center justify-center px-6 text-center">
          <div className="pointer-events-auto mx-auto flex w-full max-w-3xl flex-col items-center gap-8 rounded-[2rem] border border-white/10 bg-black/35 p-8 backdrop-blur-xl sm:p-10">
            <div className="space-y-4">
              <p className="text-xl font-black tracking-widest text-emerald-200/70">FINTRACK</p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                Financial Intelligence Dashboard
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Search a ticker, company, or sector to surface live market context, headlines, and AI-generated insights.
              </p>
            </div>

            <div className="w-full max-w-xl">
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/8 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-md">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search ticker, company, or sector"
                    className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-400 px-5 py-2 text-sm font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                    disabled={loading}
                  >
                    {loading ? 'Analyzing' : 'Analyze'}
                  </button>
                </div>
              </form>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={recentSearchesEnabled}
                    onChange={handleRecentSearchToggle}
                    className="h-4 w-4 rounded border-slate-600 bg-transparent text-white focus:ring-0"
                  />
                  Recent searches
                </label>

                {recentSearchesEnabled && recentSearches.length > 0 ? (
                  recentSearches.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleRecentSearchClick(item)}
                      className="rounded-md border border-white/10 px-3 py-1 text-sm text-slate-300 transition hover:text-white"
                    >
                      {item}
                    </button>
                  ))
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#040507] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 sm:px-8 lg:px-10">
        <header className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
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
              <p className="text-2xl font-bold tracking-wide text-gray-300">{heroTicker}</p>
              <h1 className="text-6xl font-semibold tabular-nums tracking-tight text-white sm:text-7xl lg:text-8xl" style={{ color: stockData.has_live_quote ? themeColor : '#e2e8f0' }}>
                <span>{currencySymbol}</span>
                <span>{currentPriceText}</span>
              </h1>
              {stockData.company_name ? <p className="max-w-2xl text-lg text-slate-400">{stockData.company_name}</p> : null}
            </div>
          </div>

          <div className="w-full max-w-xl space-y-4 lg:pt-6">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ticker, company, or sector"
                  className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  className="rounded-md px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                  style={{ backgroundColor: themeColor }}
                  disabled={loading}
                >
                  {loading ? 'Analyzing' : 'Analyze'}
                </button>
              </div>
            </form>

            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={recentSearchesEnabled}
                  onChange={handleRecentSearchToggle}
                  className="h-4 w-4 rounded border-slate-600 bg-transparent text-white focus:ring-0"
                />
                Recent searches
              </label>

              {recentSearchesEnabled && recentSearches.length > 0 ? (
                recentSearches.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleRecentSearchClick(item)}
                    className="rounded-md border border-white/8 px-3 py-1 text-sm text-slate-300 transition hover:text-white"
                  >
                    {item}
                  </button>
                ))
              ) : null}
            </div>
          </div>
        </header>

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
            {isMacroSectorView ? (
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

          <section className="max-w-3xl space-y-8">
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
          </section>

          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-large uppercase tracking-[0.35em] text-slate-500">Recent News</p>
                <h2 className="mt-3 text-xl font-medium text-white">Headlines</h2>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
              {(data?.news_articles ?? []).length > 0 ? (
                (data?.news_articles ?? []).map((article, index) => (
                  <a
                    key={`${article.title}-${article.published_at}`}
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block"
                  >
                    <TiltedCard
                      imageSrc={getArticleImageSrc(article, index)}
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
