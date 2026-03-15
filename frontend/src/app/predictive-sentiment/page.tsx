"use client";

import { useState } from "react";
import Link from "next/link";

export default function PredictiveSentimentPage() {
  const [eventText, setEventText] = useState("");
  const [tickers, setTickers] = useState("");

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Predictive Sentiment</h1>
        <p className="text-sm text-gray-400 mt-1">
          Simulate social media reactions and compare predicted vs actual sentiment
        </p>
      </div>

      {/* Input form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Financial Event
          </label>
          <textarea
            value={eventText}
            onChange={(e) => setEventText(e.target.value)}
            rows={3}
            placeholder='e.g., "Bank of Canada announces 0.25% rate cut"'
            className="w-full text-sm border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Tickers to Monitor
          </label>
          <input
            type="text"
            value={tickers}
            onChange={(e) => setTickers(e.target.value)}
            placeholder="RY.TO, TD.TO, BNS.TO"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <button
          disabled
          className="px-6 py-2.5 bg-gray-300 text-white text-sm font-medium rounded-lg cursor-not-allowed"
        >
          Predict Sentiment (Coming Soon)
        </button>
      </div>

      {/* Explanation */}
      <div className="bg-purple-50 rounded-xl border border-purple-100 p-6">
        <h2 className="text-sm font-semibold text-purple-900 mb-2">How it works</h2>
        <div className="space-y-2 text-sm text-purple-800">
          <p>
            1. Describe a financial event that could affect market sentiment
          </p>
          <p>
            2. AI agents simulate how Reddit and Twitter users would react
          </p>
          <p>
            3. Compare predicted sentiment distribution with actual social media data
          </p>
          <p>
            4. High divergence between predicted and actual sentiment = potential trading signal
          </p>
        </div>
      </div>

      {/* Cross-links */}
      <div className="flex gap-3">
        <Link
          href="/scenarios"
          className="text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Run Scenario Instead &rarr;
        </Link>
        <Link
          href="/knowledge-graph"
          className="text-xs bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Explore Knowledge Graph &rarr;
        </Link>
      </div>
    </div>
  );
}
