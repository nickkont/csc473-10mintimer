import { admin, adminDb } from "../firebaseAdmin.js";

const TICK_INTERVAL_MS = 30_000;
const MAX_LIFETIME_SECONDS = 30 * 24 * 60 * 60; // 30 days
const BASE_VOLATILITY = 0.005;
const MAX_VOLATILITY = 0.045;
const MIN_PRICE = 0.02;
const MAX_PRICE = 0.98;
const MEAN_REVERSION_PULL = 0.001;
const HISTORY_KEEP = 200;

interface OpenMarket {
  id: string;
  yesPrice: number;
  closesAtSeconds: number | null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function nextPrice(currentYes: number, closesAtSec: number | null): number {
  const now = Date.now() / 1000;
  let proximityRatio = 0;
  if (closesAtSec && closesAtSec > now) {
    const timeToClose = closesAtSec - now;
    proximityRatio = clamp(1 - timeToClose / MAX_LIFETIME_SECONDS, 0, 1);
  } else if (closesAtSec && closesAtSec <= now) {
    proximityRatio = 1;
  }
  const volatility = BASE_VOLATILITY + proximityRatio * (MAX_VOLATILITY - BASE_VOLATILITY);
  const noise = (Math.random() - 0.5) * 2 * volatility;
  const reversion = (0.5 - currentYes) * MEAN_REVERSION_PULL;
  const delta = noise + reversion;
  return clamp(parseFloat((currentYes + delta).toFixed(4)), MIN_PRICE, MAX_PRICE);
}

async function pruneHistory(marketId: string): Promise<void> {
  const oldSnap = await adminDb
    .collection(`markets/${marketId}/priceHistory`)
    .orderBy("timestamp", "desc")
    .offset(HISTORY_KEEP)
    .limit(50)
    .get();
  if (oldSnap.empty) return;
  const batch = adminDb.batch();
  oldSnap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

async function tickOnce(): Promise<void> {
  const snap = await adminDb.collection("markets").where("status", "==", "open").get();
  if (snap.empty) return;

  const markets: OpenMarket[] = snap.docs.map((d) => {
    const data = d.data() as { yesPrice?: number; closesAt?: { _seconds?: number; seconds?: number } };
    const yp = Number(data.yesPrice);
    const ca = data.closesAt;
    const sec = ca ? Number(ca._seconds ?? ca.seconds ?? 0) : null;
    return {
      id: d.id,
      yesPrice: isFinite(yp) ? yp : 0.5,
      closesAtSeconds: sec && sec > 0 ? sec : null,
    };
  });

  for (const m of markets) {
    const newYes = nextPrice(m.yesPrice, m.closesAtSeconds);
    const newNo = parseFloat((1 - newYes).toFixed(4));
    const marketRef = adminDb.doc(`markets/${m.id}`);
    const historyRef = adminDb.collection(`markets/${m.id}/priceHistory`).doc();
    const batch = adminDb.batch();
    batch.update(marketRef, { yesPrice: newYes, noPrice: newNo });
    batch.set(historyRef, {
      yesPrice: newYes,
      noPrice: newNo,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    try {
      await batch.commit();
      await pruneHistory(m.id);
    } catch (e) {
      console.error(`[priceTicker] failed to update ${m.id}:`, e);
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export function startPriceTicker(): void {
  if (timer) return;
  console.log(`[priceTicker] starting (every ${TICK_INTERVAL_MS / 1000}s)`);
  void tickOnce().catch((e) => console.error("[priceTicker] first tick failed:", e));
  timer = setInterval(() => {
    void tickOnce().catch((e) => console.error("[priceTicker] tick failed:", e));
  }, TICK_INTERVAL_MS);
}

export function stopPriceTicker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
