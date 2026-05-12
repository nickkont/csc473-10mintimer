import { admin, adminDb } from "../firebaseAdmin.js";
import { placeBetCore } from "./placeBet.js";

const TICK_INTERVAL_MS = 15_000;
const BOT_STARTING_BALANCE = 5_000;
const BOT_REPLENISH_THRESHOLD = 50;

interface Bot {
  uid: string;
  displayName: string;
}

const BOTS: Bot[] = [
  { uid: "bot-casey", displayName: "Casey" },
  { uid: "bot-jordan", displayName: "Jordan" },
  { uid: "bot-riley", displayName: "Riley" },
];

async function ensureBots(): Promise<void> {
  for (const b of BOTS) {
    const ref = adminDb.doc(`users/${b.uid}`);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        displayName: b.displayName,
        firstName: b.displayName,
        username: b.uid,
        bio: "Automated demo trader.",
        walletBalance: BOT_STARTING_BALANCE,
        role: "user",
        isBot: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[botTrader] seeded ${b.displayName} (${b.uid})`);
    } else {
      const bal = Number(snap.data()?.walletBalance) || 0;
      if (bal < BOT_REPLENISH_THRESHOLD) {
        await ref.update({ walletBalance: BOT_STARTING_BALANCE });
        console.log(`[botTrader] replenished ${b.displayName} to $${BOT_STARTING_BALANCE}`);
      }
    }
  }
}

async function pickOpenMarket(): Promise<{ id: string; yesPrice: number; noPrice: number } | null> {
  const snap = await adminDb.collection("markets").where("status", "==", "open").get();
  if (snap.empty) return null;
  const docs = snap.docs;
  const pick = docs[Math.floor(Math.random() * docs.length)];
  const d = pick.data() as { yesPrice?: number; noPrice?: number };
  return {
    id: pick.id,
    yesPrice: Number(d.yesPrice) || 0.5,
    noPrice: Number(d.noPrice) || 0.5,
  };
}

async function tickOnce(): Promise<void> {
  try {
    await ensureBots();
    const market = await pickOpenMarket();
    if (!market) return;

    const bot = BOTS[Math.floor(Math.random() * BOTS.length)];
    const side: "yes" | "no" = Math.random() < 0.5 ? "yes" : "no";
    const shares = 1 + Math.floor(Math.random() * 4); // 1-4 shares

    try {
      await placeBetCore({
        uid: bot.uid,
        marketId: market.id,
        side,
        shares,
        actorName: bot.displayName,
      });
    } catch (e) {
      // Insufficient balance or market resolved between picks — ignore
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("Insufficient") && !msg.includes("resolved")) {
        console.error(`[botTrader] ${bot.displayName} bet failed:`, msg);
      }
    }
  } catch (e) {
    console.error("[botTrader] tick failed:", e);
  }
}

let timer: NodeJS.Timeout | null = null;

export function startBotTrader(): void {
  if (timer) return;
  console.log(`[botTrader] starting (every ${TICK_INTERVAL_MS / 1000}s, ${BOTS.length} bots)`);
  void tickOnce();
  timer = setInterval(() => void tickOnce(), TICK_INTERVAL_MS);
}

export function stopBotTrader(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
