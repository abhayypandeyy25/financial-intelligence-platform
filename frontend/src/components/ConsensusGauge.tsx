"use client";

interface ConsensusGaugeProps {
  score: number; // -1.0 to 1.0
  size?: number;
}

export default function ConsensusGauge({ score, size = 120 }: ConsensusGaugeProps) {
  // Normalize score from [-1, 1] to [0, 100] for the arc
  const normalized = ((score + 1) / 2) * 100;
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (normalized / 100) * circumference;

  // Color based on score
  const getColor = () => {
    if (score > 0.3) return "#10b981"; // green
    if (score > 0) return "#6ee7b7";   // light green
    if (score > -0.3) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  const getLabel = () => {
    if (score > 0.3) return "Bullish";
    if (score > 0) return "Lean Bull";
    if (score > -0.3) return "Mixed";
    return "Bearish";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-700"
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-xl font-bold"
          style={{ color: getColor() }}
        >
          {score > 0 ? "+" : ""}{score.toFixed(2)}
        </span>
        <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
          {getLabel()}
        </span>
      </div>
    </div>
  );
}
