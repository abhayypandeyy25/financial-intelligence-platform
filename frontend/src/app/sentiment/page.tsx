"use client";

import { useEffect, useState } from "react";
import { api, SentimentPost } from "@/lib/api";
import StatCard from "@/components/StatCard";

export default function SentimentPage() {
  const [posts, setPosts] = useState<SentimentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<string>("");
  const [tickerFilter, setTickerFilter] = useState<string>("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const data = await api.getSentiment({ days: 7, limit: 100 });
      setPosts(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await api.refreshSentiment();
      // Reload data
      const data = await api.getSentiment({ days: 7, limit: 100 });
      setPosts(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading sentiment data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
        <h2 className="text-red-400 font-semibold">Error</h2>
        <p className="text-slate-400 mt-1 text-sm">{error}</p>
      </div>
    );
  }

  // Parse tickers from all posts
  function parseTickers(tickersJson: string | null): string[] {
    if (!tickersJson) return [];
    try {
      return JSON.parse(tickersJson);
    } catch {
      return [];
    }
  }

  // Get unique tickers mentioned across all posts
  const allTickers = Array.from(
    new Set(posts.flatMap((p) => parseTickers(p.tickers_mentioned)))
  ).sort();

  // Filter posts
  const filtered = posts.filter((p) => {
    if (sentimentFilter && p.sentiment !== sentimentFilter) return false;
    if (tickerFilter && !parseTickers(p.tickers_mentioned).includes(tickerFilter)) return false;
    return true;
  });

  // Compute stats
  const totalPosts = posts.length;
  const positivePosts = posts.filter((p) => p.sentiment === "positive").length;
  const negativePosts = posts.filter((p) => p.sentiment === "negative").length;
  const avgUpvotes = totalPosts > 0
    ? Math.round(posts.reduce((sum, p) => sum + p.upvotes, 0) / totalPosts)
    : 0;
  const totalComments = posts.reduce((sum, p) => sum + p.comments_count, 0);

  // Get unique sources
  const sources = Array.from(new Set(posts.map((p) => p.source)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Community Sentiment</h1>
          <p className="text-slate-400 text-sm mt-1">
            Reddit posts from Canadian investing communities
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {refreshing ? "Scraping..." : "Scrape Reddit"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Posts" value={totalPosts} color="blue" />
        <StatCard
          title="Tickers Mentioned"
          value={allTickers.length}
          subtitle={allTickers.slice(0, 3).join(", ") || "None"}
          color="emerald"
        />
        <StatCard
          title="Avg Upvotes"
          value={avgUpvotes}
          subtitle={`${totalComments} total comments`}
          color="amber"
        />
        <StatCard
          title="Sentiment Split"
          value={positivePosts > negativePosts ? "Bullish" : negativePosts > positivePosts ? "Bearish" : "Neutral"}
          subtitle={`${positivePosts} positive, ${negativePosts} negative`}
          color={positivePosts > negativePosts ? "emerald" : negativePosts > positivePosts ? "red" : "amber"}
        />
      </div>

      {/* Filters */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap gap-4 items-center">
        <select
          value={sentimentFilter}
          onChange={(e) => setSentimentFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">All Sentiment</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="neutral">Neutral</option>
        </select>
        <select
          value={tickerFilter}
          onChange={(e) => setTickerFilter(e.target.value)}
          className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">All Tickers</option>
          {allTickers.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Showing {filtered.length} of {posts.length} posts | Sources: {sources.join(", ")}
        </span>
      </div>

      {/* Posts */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-400">No sentiment data found.</p>
          <p className="text-slate-500 text-sm mt-1">
            Click &quot;Scrape Reddit&quot; to fetch community posts from r/CanadianInvestor and r/CanadaFinance.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((post) => {
            const tickers = parseTickers(post.tickers_mentioned);
            const sentimentColor =
              post.sentiment === "positive"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : post.sentiment === "negative"
                ? "bg-red-500/10 text-red-400 border-red-500/30"
                : post.sentiment === "neutral"
                ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                : "bg-slate-800 text-slate-400 border-slate-700";

            return (
              <div
                key={post.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Content */}
                    <p className="text-sm text-slate-200 line-clamp-3">
                      {post.content}
                    </p>

                    {/* Tickers */}
                    {tickers.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {tickers.map((t) => (
                          <span
                            key={t}
                            className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                      <span className="bg-slate-800 px-2 py-0.5 rounded">
                        {post.source}
                      </span>
                      {post.author && (
                        <span>u/{post.author}</span>
                      )}
                      <span>
                        {post.posted_at
                          ? new Date(post.posted_at).toLocaleDateString()
                          : ""}
                      </span>
                      <span>
                        {post.upvotes} upvotes
                      </span>
                      <span>
                        {post.comments_count} comments
                      </span>
                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300"
                        >
                          View on Reddit
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Sentiment badge */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {post.sentiment ? (
                      <span
                        className={`text-xs px-3 py-1 rounded-full border ${sentimentColor}`}
                      >
                        {post.sentiment}
                      </span>
                    ) : (
                      <span className="text-xs px-3 py-1 rounded-full bg-slate-800 text-slate-500 border border-slate-700">
                        unprocessed
                      </span>
                    )}
                    {post.confidence != null && (
                      <span className="text-xs text-slate-500">
                        {(post.confidence * 100).toFixed(0)}% conf
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
