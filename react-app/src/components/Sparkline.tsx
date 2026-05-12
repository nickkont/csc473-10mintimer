import { useMemo } from "react";
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from "recharts";
import type { PriceTick } from "../api/markets";

interface Props {
  history: PriceTick[];
  /** When omitted (or "both"), shows YES and NO lines simultaneously. */
  side?: "yes" | "no" | "both";
  height?: number;
}

export default function Sparkline({ history, side = "both", height = 36 }: Props): JSX.Element {
  const data = useMemo(
    () =>
      history.map((h) => ({
        yes: h.yesPrice,
        no: h.noPrice,
      })),
    [history]
  );

  if (data.length < 2) {
    return <div className="sparkline-placeholder" style={{ height }} />;
  }

  if (side === "both") {
    return (
      <div className="sparkline" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
            <Line
              type="monotone"
              dataKey="yes"
              stroke="#22c55e"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="no"
              stroke="#ef4444"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  const color = side === "yes" ? "#22c55e" : "#ef4444";
  const key = side === "yes" ? "yes" : "no";

  return (
    <div className="sparkline" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${side}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey={key}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#spark-${side})`}
            isAnimationActive={false}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
