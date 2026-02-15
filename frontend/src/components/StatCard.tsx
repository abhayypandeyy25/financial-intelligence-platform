interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
  trend?: "up" | "down";
}

const colorClasses = {
  emerald: "border-emerald-500/30 bg-emerald-50",
  blue: "border-blue-500/30 bg-blue-50",
  amber: "border-amber-500/30 bg-amber-50",
  red: "border-red-500/30 bg-red-50",
  purple: "border-purple-500/30 bg-purple-50",
};

const valueColorClasses = {
  emerald: "text-emerald-600",
  blue: "text-blue-600",
  amber: "text-amber-600",
  red: "text-red-600",
  purple: "text-purple-600",
};

export default function StatCard({ title, value, subtitle, color = "blue", trend }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <div className="flex items-center gap-2 mt-1">
        <p className={`text-3xl font-bold ${valueColorClasses[color]}`}>
          {value}
        </p>
        {trend && (
          <span className={trend === "up" ? "text-emerald-500" : "text-red-500"}>
            {trend === "up" ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            )}
          </span>
        )}
      </div>
      {subtitle && (
        <p className="text-gray-400 text-xs mt-1">{subtitle}</p>
      )}
    </div>
  );
}
