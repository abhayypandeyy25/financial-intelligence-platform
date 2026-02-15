interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "emerald" | "blue" | "amber" | "red" | "purple";
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

export default function StatCard({ title, value, subtitle, color = "blue" }: StatCardProps) {
  return (
    <div className={`rounded-xl border p-5 ${colorClasses[color]}`}>
      <p className="text-gray-500 text-sm font-medium">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${valueColorClasses[color]}`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-gray-400 text-xs mt-1">{subtitle}</p>
      )}
    </div>
  );
}
