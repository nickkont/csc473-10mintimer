import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase";

const BOT_NAMES = [
  "Alex T.", "Jordan M.", "Sam K.", "Riley C.", "Morgan B.",
  "Casey D.", "Quinn R.", "Taylor S.", "Drew A.", "Blake W.",
  "Avery H.", "Reese L.", "Parker N.", "Skyler J.", "Rowan F.",
  "Jamie O.", "Dana P.", "Emery V.", "Sage W.", "Remy X.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function nudgePrice(
  yesPrice: number,
  side: "yes" | "no",
  shares: number
): { yesPrice: number; noPrice: number } {
  // Higher impact: 0.035 per share — 8 shares can swing ~28%
  const impact = shares * 0.035;
  let ny =
    side === "yes"
      ? yesPrice + impact * (1 - yesPrice)
      : yesPrice - impact * yesPrice;
  ny = Math.max(0.03, Math.min(0.97, parseFloat(ny.toFixed(2))));
  return { yesPrice: ny, noPrice: parseFloat((1 - ny).toFixed(2)) };
}

function driftPrice(yesPrice: number): { yesPrice: number; noPrice: number } {
  // ±6% random walk each drift tick
  const drift = (Math.random() - 0.5) * 0.12;
  const ny = Math.max(0.03, Math.min(0.97, parseFloat((yesPrice + drift).toFixed(2))));
  return { yesPrice: ny, noPrice: parseFloat((1 - ny).toFixed(2)) };
}

async function getOpenMarkets() {
  const snap = await getDocs(
    query(collection(db, "markets"), where("status", "==", "open"))
  );
  return snap.docs;
}

async function runBotTrade(): Promise<void> {
  try {
    const markets = await getOpenMarkets();
    if (!markets.length) return;

    // Occasionally trade 2 markets at once for more activity
    const count = Math.random() > 0.6 ? 2 : 1;
    const targets = [...markets].sort(() => Math.random() - 0.5).slice(0, Math.min(count, markets.length));

    for (const mDoc of targets) {
      const mData = mDoc.data() as {
        yesPrice: number; noPrice: number;
        totalTrades: number; title: string; status: string;
      };
      if (mData.status !== "open") continue;

      // Bias: bots sometimes chase momentum (same direction as last move)
      const side = Math.random() > 0.48 ? "yes" : "no";
      const shares = Math.floor(Math.random() * 8) + 1; // 1–8 shares
      const cost = parseFloat(
        ((side === "yes" ? mData.yesPrice : mData.noPrice) * shares).toFixed(2)
      );
      const botName = pick(BOT_NAMES);
      const marketRef = doc(db, "markets", mDoc.id);

      await runTransaction(db, async (t) => {
        const fresh = await t.get(marketRef);
        if (!fresh.exists()) return;
        const fd = fresh.data() as typeof mData;
        if (fd.status !== "open") return;

        const { yesPrice: ny, noPrice: np } = nudgePrice(fd.yesPrice, side, shares);

        t.update(marketRef, {
          yesPrice: ny,
          noPrice: np,
          totalTrades: (fd.totalTrades || 0) + 1,
        });

        const histRef = doc(collection(db, "markets", mDoc.id, "priceHistory"));
        t.set(histRef, { yesPrice: ny, noPrice: np, timestamp: serverTimestamp() });

        const actRef = doc(collection(db, "activity"));
        t.set(actRef, {
          type: "bet",
          actorName: botName,
          side,
          shares,
          cost,
          marketId: mDoc.id,
          marketTitle: fd.title,
          timestamp: serverTimestamp(),
        });
      });
    }
  } catch {
    // silently ignore
  }
}

async function runPriceDrift(): Promise<void> {
  try {
    const markets = await getOpenMarkets();
    if (!markets.length) return;

    // Drift 2–4 random markets per tick
    const count = Math.min(markets.length, Math.floor(Math.random() * 3) + 2);
    const shuffled = [...markets].sort(() => Math.random() - 0.5).slice(0, count);

    await Promise.all(
      shuffled.map(async (mDoc) => {
        const fd = mDoc.data() as { yesPrice: number; status: string };
        if (fd.status !== "open") return;
        const { yesPrice: ny, noPrice: np } = driftPrice(fd.yesPrice);
        const marketRef = doc(db, "markets", mDoc.id);
        try {
          await updateDoc(marketRef, { yesPrice: ny, noPrice: np });
          await addDoc(collection(db, "markets", mDoc.id, "priceHistory"), {
            yesPrice: ny, noPrice: np, timestamp: serverTimestamp(),
          });
        } catch {
          // ignore per-market failures
        }
      })
    );
  } catch {
    // ignore
  }
}

export function useBotEngine(): void {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // First ticks fire quickly so the page feels alive immediately
    const t1 = setTimeout(() => void runBotTrade(),  5000);
    const t2 = setTimeout(() => void runPriceDrift(), 10000);

    // Bot trades: every 35–65 seconds
    let tradeTimer: ReturnType<typeof setTimeout>;
    const scheduleTrade = (): void => {
      const delay = 35000 + Math.random() * 30000;
      tradeTimer = setTimeout(() => {
        void runBotTrade();
        scheduleTrade();
      }, delay);
    };
    scheduleTrade();

    // Price drift: every 20–40 seconds
    let driftTimer: ReturnType<typeof setTimeout>;
    const scheduleDrift = (): void => {
      const delay = 20000 + Math.random() * 20000;
      driftTimer = setTimeout(() => {
        void runPriceDrift();
        scheduleDrift();
      }, delay);
    };
    scheduleDrift();

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(tradeTimer);
      clearTimeout(driftTimer);
    };
  }, [user]);
}
