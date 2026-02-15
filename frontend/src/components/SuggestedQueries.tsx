"use client";

interface SuggestedQueriesProps {
  queries: string[];
  onSelect: (query: string) => void;
  disabled?: boolean;
}

export default function SuggestedQueries({
  queries,
  onSelect,
  disabled,
}: SuggestedQueriesProps) {
  if (queries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {queries.map((q, i) => (
        <button
          key={i}
          onClick={() => onSelect(q)}
          disabled={disabled}
          className="text-xs bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-full hover:border-emerald-500 hover:text-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {q}
        </button>
      ))}
    </div>
  );
}
