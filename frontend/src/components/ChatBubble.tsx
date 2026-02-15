"use client";

import Link from "next/link";

interface Reference {
  type: string;
  id?: number;
  ticker?: string;
}

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  references?: Reference[];
}

function renderContent(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (line.trim() === "") {
      elements.push(<br key={`br-${lineIdx}`} />);
      return;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={lineIdx} className="font-semibold text-sm mt-3 mb-1">
          {line.slice(4)}
        </h4>
      );
      return;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={lineIdx} className="font-semibold text-base mt-3 mb-1">
          {line.slice(3)}
        </h3>
      );
      return;
    }

    const isBullet = /^[-*]\s/.test(line.trim());
    const content = isBullet ? line.trim().slice(2) : line;
    const parts = parseInline(content);

    if (isBullet) {
      elements.push(
        <div key={lineIdx} className="flex gap-2 ml-2">
          <span className="text-gray-400">•</span>
          <span>{parts}</span>
        </div>
      );
    } else {
      elements.push(
        <p key={lineIdx} className="leading-relaxed">
          {parts}
        </p>
      );
    }
  });

  return elements;
}

function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\[Signal #(\d+)\]|([A-Z]{1,5}\.TO))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      nodes.push(
        <strong key={key++} className="font-semibold text-gray-900">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      nodes.push(
        <code
          key={key++}
          className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono text-emerald-700"
        >
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      const signalId = match[4];
      nodes.push(
        <Link
          key={key++}
          href={`/signals/${signalId}`}
          className="text-emerald-600 hover:text-emerald-500 underline decoration-dotted"
          onClick={(e) => e.stopPropagation()}
        >
          Signal #{signalId}
        </Link>
      );
    } else if (match[5]) {
      const ticker = match[5];
      nodes.push(
        <Link
          key={key++}
          href={`/stocks/${ticker}`}
          className="font-mono text-emerald-600 hover:text-emerald-500 underline decoration-dotted"
          onClick={(e) => e.stopPropagation()}
        >
          {ticker}
        </Link>
      );
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export default function ChatBubble({ role, content, references }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-emerald-600 text-white rounded-br-md"
            : "bg-gray-100 text-gray-800 border border-gray-200 rounded-bl-md"
        }`}
      >
        {isUser ? (
          <p>{content}</p>
        ) : (
          <div className="space-y-1">{renderContent(content)}</div>
        )}

        {!isUser && references && references.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t border-gray-200">
            {references.map((ref, i) =>
              ref.type === "signal" && ref.id ? (
                <Link
                  key={i}
                  href={`/signals/${ref.id}`}
                  className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full hover:bg-purple-200 transition-colors"
                >
                  Signal #{ref.id}
                </Link>
              ) : ref.type === "stock" && ref.ticker ? (
                <Link
                  key={i}
                  href={`/stocks/${ref.ticker}`}
                  className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full hover:bg-emerald-200 transition-colors font-mono"
                >
                  {ref.ticker}
                </Link>
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}
