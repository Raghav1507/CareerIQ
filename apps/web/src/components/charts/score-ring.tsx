import { cn } from "@/lib/utils";

type Props = {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
};

/**
 * Deterministic score ring. The value always comes from the M1 formula
 * computed server-side — this component only renders it.
 */
export function ScoreRing({ value, size = 132, strokeWidth = 10, label, className }: Props) {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  const tone =
    clamped >= 80 ? "var(--color-success)" : clamped >= 60 ? "var(--color-primary)" : clamped >= 40 ? "var(--color-warning)" : "var(--color-muted-foreground)";

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} role="img" aria-label={`Score ${Math.round(clamped)} of 100`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-muted)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground"
          style={{ fontSize: size / 4, fontWeight: 650 }}
        >
          {Math.round(clamped)}
        </text>
      </svg>
      {label ? (
        <span className="absolute bottom-[-6px] text-[11px] text-muted-foreground">{label}</span>
      ) : null}
    </div>
  );
}
