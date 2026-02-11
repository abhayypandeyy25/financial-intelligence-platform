interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
}

const colorClasses = {
  emerald: "border-emerald-500/30 bg-emerald-500/5",
  blue: "border-blue-500/30 bg-blue-500/5",
  amber: "border-amber-500/30 bg-amber-500/5",
  red: "border-red-500/30 bg-red-500/5",
  purple: "border-purple-500/30 bg-purple-500/5",
};

const valueColorClasses = {
  emerald: "text-emerald-400",
  blue: "text-blue-400",
  amber: "text-amber-400",
  red: "text-red-400",
  purple: "text-purple-400",
};

export default function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <p className="text-slate-400 text-sm font-medium">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${valueColorClasses[color]}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-slate-500 text-xs mt-1">{subtitle}</p>
      )}
    </div>
  );
}
