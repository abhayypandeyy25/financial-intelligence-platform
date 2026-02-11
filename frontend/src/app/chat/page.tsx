"use client";

import { useEffect, useRef, useState } from "react";
import { api, ChatMessage, ChatResponse } from "@/lib/api";
import ChatBubble from "@/components/ChatBubble";
import SuggestedQueries from "@/components/SuggestedQueries";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load initial suggestions
  useEffect(() => {
    api
      .getChatSuggestions()
      .then(setSuggestions)
      .catch(() =>
        setSuggestions([
          "What are the top bullish signals this week?",
          "Which sector has the best accuracy?",
          "Show me the latest community sentiment",
        ])
      )
      .finally(() => setLoadingSuggestions(false));
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text.trim(),
      references: [],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response: ChatResponse = await api.chat(
        text.trim(),
        messages.concat(userMessage)
      );

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: response.response,
        references: response.references,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update suggestions with follow-up queries
      if (response.suggested_queries.length > 0) {
        setSuggestions(response.suggested_queries);
      }
    } catch {
      const errorMessage: ChatMessage = {
        role: "assistant",
        content:
          "Sorry, I couldn't process your request. Please make sure the backend is running and try again.",
        references: [],
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setLoading(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="flex-none pb-4">
        <h1 className="text-2xl font-bold">AI Financial Assistant</h1>
        <p className="text-slate-400 text-sm mt-1">
          Ask questions about TSX stocks, signals, sentiment, and market themes
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-200 mb-2">
              How can I help you today?
            </h2>
            <p className="text-sm text-slate-400 max-w-md mb-6">
              I can analyze TSX signals, look up stock data, summarize
              community sentiment, and explain market themes. Try a question
              below or type your own.
            </p>

            {/* Initial suggestions */}
            {!loadingSuggestions && (
              <SuggestedQueries
                queries={suggestions}
                onSelect={sendMessage}
                disabled={loading}
              />
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatBubble
            key={i}
            role={msg.role}
            content={msg.content}
            references={msg.references}
          />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-xs text-slate-500">Analyzing...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions bar (shown after conversation starts) */}
      {messages.length > 0 && suggestions.length > 0 && !loading && (
        <div className="flex-none py-2">
          <SuggestedQueries
            queries={suggestions}
            onSelect={sendMessage}
            disabled={loading}
          />
        </div>
      )}

      {/* Input area */}
      <div className="flex-none pt-2 border-t border-slate-800">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about stocks, signals, themes..."
            rows={1}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 rounded-xl text-sm font-medium transition-colors"
          >
            {loading ? (
              <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-2 text-center">
          AI-generated analysis, not financial advice. Press Enter to send, Shift+Enter for new line.
        </p>
      </div>
    </div>
  );
}
