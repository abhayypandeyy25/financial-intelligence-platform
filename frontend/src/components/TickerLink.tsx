import Link from "next/link";

interface TickerLinkProps {
  ticker: string;
  showSuffix?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function TickerLink({ ticker, showSuffix = false, size = "sm" }: TickerLinkProps) {
  const sizeClasses = {
    sm: "text-sm px-1.5 py-0.5",
    md: "text-base px-2 py-1",
    lg: "text-lg px-2.5 py-1",
  };

  return (
    <Link
      href={`/stocks/${encodeURIComponent(ticker)}`}
      className={`font-mono font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 rounded transition-colors ${sizeClasses[size]}`}
    >
      {showSuffix ? ticker : ticker.replace(".TO", "")}
    </Link>
  );
}
