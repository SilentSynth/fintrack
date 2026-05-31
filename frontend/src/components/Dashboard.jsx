import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const RECENT_SEARCHES_STORAGE_KEY = 'fintrack.recentSearches';
const RECENT_SEARCHES_ENABLED_STORAGE_KEY = 'fintrack.recentSearchesEnabled';

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
      className="group rounded-2xl border border-white/10 bg-slate-900/70 p-5 transition hover:-translate-y-1 hover:border-cyan-400/30 hover:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">{article.source}</p>
        <span className="text-xs text-slate-500">{article.published_at?.slice(0, 10)}</span>
      </div>
      <h3 className="mt-4 text-lg font-semibold leading-7 text-slate-50 group-hover:text-cyan-200">{article.title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-300">{article.description || 'Open to read the full article.'}</p>
    </a>
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

  function runSearch(nextQuery) {
    setQuery(nextQuery);
    setLoading(true);
    setError('');
    setData(null);
    setSubmittedQuery('');

    return fetch(`${API_BASE_URL}/api/insights/${encodeURIComponent(nextQuery)}`)
      .then((response) => response.json().catch(() => null).then((payload) => ({ response, payload })))
      .then(({ response, payload }) => {
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
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load dashboard data.');
        setData(null);
      })
      .finally(() => {
        setLoading(false);
      });
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
  const aiSummary = data?.ai_summary ?? {};
  const currentMarketState = toBulletList(aiSummary.current_market_state);
  const criticalDevelopments = toBulletList(aiSummary.critical_developments);
  const sentimentScore = normalizeSentiment(aiSummary.sentiment_score);
  const sentiment = sentimentDetails(sentimentScore);
  const isMacroSectorView = data?.view_mode === 'macro_sector' || !stockData.has_live_quote;
  const alerts = Array.isArray(data?.alerts) ? data.alerts : [];

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">FinTrack</p>
              <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Financial Intelligence Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Search a ticker, company, or sector to view live market context, recent headlines, and a Gemini-generated market brief.
              </p>
            </div>

            <form onSubmit={handleSearch} className="flex w-full max-w-xl gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search ticker, company, or sector, e.g. AAPL or Steel Industry"
                className="flex-1 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none ring-0 placeholder:text-slate-500 focus:border-cyan-400/50"
              />
              <button
                type="submit"
                className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={loading}
              >
                {loading ? 'Analyzing' : 'Analyze'}
              </button>
            </form>
          </div>

          <div className="mt-6 flex flex-col gap-4 border-t border-white/10 pt-5 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-3 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={recentSearchesEnabled}
                onChange={handleRecentSearchToggle}
                className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
              />
              Recent Searches
              <span className="text-xs text-slate-500">{recentSearchesEnabled ? 'On' : 'Off'}</span>
            </label>

            {recentSearchesEnabled && recentSearches.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleRecentSearchClick(item)}
                    className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-400/30 hover:text-cyan-200"
                  >
                    {item}
                  </button>
                ))}
              </div>
            ) : recentSearchesEnabled ? (
              <p className="text-xs text-slate-500">No recent searches yet.</p>
            ) : (
              <p className="text-xs text-slate-500">Recent searches are turned off.</p>
            )}
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        {alerts.length > 0 ? (
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <AlertBanner key={`${alert.title}-${index}`} alert={alert} />
            ))}
          </div>
        ) : null}

        {loading ? (
          <main className="grid gap-6 lg:grid-cols-3">
            <SkeletonCard className="lg:col-span-1">
              <SummarySkeleton />
            </SkeletonCard>
            <SkeletonCard className="lg:col-span-2">
              <ChartSkeleton />
            </SkeletonCard>
            <SkeletonCard className="lg:col-span-3">
              <div className="mb-6 h-4 w-36 rounded-full bg-slate-800" />
              <NewsSkeleton />
            </SkeletonCard>
          </main>
        ) : null}

        {!loading && data ? (
          <main className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 lg:col-span-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">Market Summary</p>
                  <h2 className="mt-1 text-2xl font-semibold">{submittedQuery.toUpperCase()}</h2>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${sentiment.badgeClass}`}>
                  {sentiment.label}
                </span>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Sentiment Score</p>
                  <span className="text-sm font-semibold text-slate-200">
                    {sentimentScore}/10
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-800">
                  <div
                    className={`h-2 rounded-full ${sentiment.fillClass}`}
                    style={{ width: `${sentimentScore * 10}%` }}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-400">{sentiment.description}</p>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Current Market State</p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-200">
                    {currentMarketState.length > 0 ? (
                      currentMarketState.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex gap-3">
                          <span className="mt-2 h-2 w-2 rounded-full bg-cyan-300" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-400">No summary available.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-2xl bg-slate-900/70 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Critical Developments</p>
                  <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-200">
                    {criticalDevelopments.length > 0 ? (
                      criticalDevelopments.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex gap-3">
                          <span className="mt-2 h-2 w-2 rounded-full bg-amber-300" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-400">No critical developments were extracted.</li>
                    )}
                  </ul>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 lg:col-span-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm text-slate-400">Stock Visualization</p>
                  <h2 className="mt-1 text-2xl font-semibold">Price Trend</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Current Price</p>
                    <p className="mt-1 text-lg font-semibold">
                      {stockData.current_price !== null && stockData.current_price !== undefined
                        ? `${currencySymbol}${Number(stockData.current_price).toFixed(2)}`
                        : 'N/A'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-900/70 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Market Cap</p>
                    <p className="mt-1 text-lg font-semibold">{formatMarketCap(stockData.market_cap, currencySymbol)}</p>
                  </div>
                </div>
              </div>

              {isMacroSectorView ? (
                <div className="mt-6 flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-900/70 px-6 text-center">
                  <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-200">
                    Macro Sector View
                  </span>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
                    No direct stock ticker was resolved for this search, so the live chart is disabled. The summary and news feed remain available.
                  </p>
                </div>
              ) : loading ? (
                <div className="mt-6 flex h-80 items-center justify-center rounded-2xl bg-slate-900/70 text-sm text-slate-400">
                  Loading chart data...
                </div>
              ) : chartData.length > 0 ? (
                <div className="mt-6 h-80 rounded-2xl bg-slate-900/70 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(148, 163, 184, 0.15)" strokeDasharray="4 4" />
                      <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 12 }} minTickGap={24} />
                      <YAxis domain={["dataMin - 5", "dataMax + 5"]} tick={{ fill: '#94a3b8', fontSize: 12 }} width={60} />
                      <Tooltip
                        contentStyle={{
                          background: '#0f172a',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 16,
                          color: '#e2e8f0',
                        }}
                        formatter={(value, name) => [
                          `${currencySymbol}${Number(value).toFixed(2)}`,
                          name === 'price' ? 'Price' : 'Close',
                        ]}
                      />
                      <Line type="monotone" dataKey="price" stroke="#22d3ee" strokeWidth={3} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-6 flex h-80 items-center justify-center rounded-2xl bg-slate-900/70 text-sm text-slate-400">
                  No historical price data available yet.
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-slate-950/30 lg:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Recent News</p>
                  <h2 className="mt-1 text-2xl font-semibold">Headlines</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.news_articles.length > 0 ? (
                  data.news_articles.map((article) => <NewsCard key={`${article.title}-${article.published_at}`} article={article} />)
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 text-sm text-slate-400">
                    No live news articles were returned.
                  </div>
                )}
              </div>
            </section>
          </main>
        ) : null}
      </div>
    </div>
  );
}
