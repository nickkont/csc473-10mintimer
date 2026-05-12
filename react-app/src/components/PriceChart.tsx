import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { PriceTick } from "../api/markets";

interface Props {
  history: PriceTick[];
  side: "yes" | "no";
}

interface Point {
  t: number;
  price: number;
  label: string;
}

function formatTime(seconds: number): string {
  const d = new Date(seconds * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function PriceChart({ history, side }: Props): JSX.Element {
  const data: Point[] = useMemo(
    () =>
      history
        .filter((h) => h.timestamp)
        .map((h) => ({
          t: h.timestamp!.seconds,
          price: side === "yes" ? h.yesPrice : h.noPrice,
          label: formatTime(h.timestamp!.seconds),
        })),
    [history, side]
  );

  const color = side === "yes" ? "#22c55e" : "#ef4444";
  const delta = useMemo(() => {
    if (data.length < 2) return 0;
    return data[data.length - 1].price - data[0].price;
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="price-chart-empty">
        Waiting for the first price tick…
      </div>
    );
  }

  const deltaClass = delta > 0.0001 ? "up" : delta < -0.0001 ? "down" : "flat";
  const deltaSign = delta >= 0 ? "+" : "";

  return (
    <div className="price-chart-wrap">
      <div className={"price-chart-delta " + deltaClass}>
        {deltaSign}${delta.toFixed(2)} over last {data.length} tick{data.length === 1 ? "" : "s"}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id={`fill-${side}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            stroke="rgba(255,255,255,0.35)"
            fontSize={11}
            width={45}
          />
          <Tooltip
            contentStyle={{
              background: "#0b1020",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "rgba(255,255,255,0.6)" }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, side.toUpperCase()]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fill={`url(#fill-${side})`}
            isAnimationActive
            animationDuration={400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
