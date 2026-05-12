import { useCallback, useEffect, useState } from "react";
import { listActivity, ActivityItem } from "../api/activity";

function formatAgo(secs: number | undefined): string {
  if (!secs) return "now";
  const diff = Math.max(0, Math.floor(Date.now() / 1000 - secs));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function renderItem(item: ActivityItem): JSX.Element {
  if (item.type === "bet") {
    const sideClass = item.side === "yes" ? "yes" : "no";
    return (
      <>
        <strong>{item.actorName ?? "Someone"}</strong>{" "}
        bought <span className={"activity-side " + sideClass}>{item.side?.toUpperCase()}</span>{" "}
        ×{item.shares} on <em>{truncate(item.marketTitle, 38)}</em>
      </>
    );
  }
  if (item.type === "payout") {
    return (
      <>
        <strong>{item.actorName ?? "Someone"}</strong>{" "}
        claimed <span className="activity-amount">${item.amount?.toFixed(2)}</span> from{" "}
        <em>{truncate(item.marketTitle, 38)}</em>
      </>
    );
  }
  return (
    <>
      Market resolved{" "}
      <span className={"activity-side " + (item.outcome ?? "")}>{item.outcome?.toUpperCase()}</span>:{" "}
      <em>{truncate(item.marketTitle, 38)}</em>
    </>
  );
}

export default function ActivityTicker(): JSX.Element {
  const [items, setItems] = useState<ActivityItem[]>([]);

  const load = useCallback(async (): Promise<void> => {
    try {
      const list = await listActivity(20);
      setItems(list);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void load();
    const i = setInterval(load, 6000);
    return () => clearInterval(i);
  }, [load]);

  return (
    <aside className="activity-ticker" aria-label="Recent activity">
      <div className="activity-ticker-head">
        <span className="activity-ticker-pulse" />
        <span>Live activity</span>
      </div>
      <div className="activity-ticker-list">
        {items.length === 0 ? (
          <p className="activity-ticker-empty">Waiting for activity…</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className={"activity-ticker-row " + item.type}>
              <div className="activity-ticker-text">{renderItem(item)}</div>
              <div className="activity-ticker-time">{formatAgo(item.timestamp?.seconds)}</div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
