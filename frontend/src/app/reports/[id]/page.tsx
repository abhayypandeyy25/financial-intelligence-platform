"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/lib/api";

export default function ReportViewerPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: string; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getReport(id)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading || !id) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatLoading(true);

    try {
      const resp = await api.chatWithReport(id, msg, chatMessages);
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: resp.response },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process your question. Please try again.",
        },
      ]);
    }
    setChatLoading(false);
  };

  const markdownContent =
    (report?.markdown_content as string) ||
    (report?.content as string) ||
    "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 bg-white shrink-0">
        <Link
          href="/reports"
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          &larr; Reports
        </Link>
        <span className="text-gray-300">|</span>
        <h1 className="text-sm font-semibold text-gray-900 truncate">
          {(report?.title as string) || "Analysis Report"}
        </h1>
      </div>

      {/* Split content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Report content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          {markdownContent ? (
            <article className="prose prose-sm prose-gray max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {markdownContent}
              </ReactMarkdown>
            </article>
          ) : (
            <div className="text-center text-gray-400 py-12">
              <p className="text-sm">Report content not available</p>
              <p className="text-xs mt-1">
                The report may still be generating.
              </p>
            </div>
          )}
        </div>

        {/* Chat panel */}
        <div className="w-[340px] border-l border-gray-200 flex flex-col bg-gray-50 shrink-0">
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <p className="text-sm font-semibold text-gray-900">Ask about this report</p>
            <p className="text-xs text-gray-400">
              Chat with the AI analyst
            </p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {chatMessages.length === 0 && (
              <div className="text-center py-8 text-xs text-gray-400">
                <p>Ask follow-up questions about the analysis</p>
                <div className="mt-3 space-y-1.5">
                  {[
                    "What were the key findings?",
                    "Which stock is most affected?",
                    "What did the agents disagree on?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setChatInput(q);
                      }}
                      className="block w-full text-left text-xs bg-white border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors text-gray-600"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-purple-600 text-white rounded-br-md"
                      : "bg-white border border-gray-200 text-gray-700 rounded-bl-md"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:0ms]" />
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:150ms]" />
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-2 border-t border-gray-200">
            <div className="flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendChat();
                  }
                }}
                placeholder="Ask a question..."
                className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500 transition-colors"
              />
              <button
                onClick={sendChat}
                disabled={chatLoading || !chatInput.trim()}
                className="px-3 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-200 text-white rounded-xl text-xs transition-colors"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
