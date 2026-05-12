import "dotenv/config";
import cors from "cors";
import express from "express";
import { startBotTrader } from "./lib/botTrader.js";
import { startPriceTicker } from "./lib/priceTicker.js";
import activityRouter from "./routes/activity.js";
import betsRouter from "./routes/bets.js";
import marketsRouter from "./routes/markets.js";
import postsRouter from "./routes/posts.js";
import usersRouter from "./routes/users.js";
import walletRouter from "./routes/wallet.js";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const corsAllow = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void): void => {
  if (!origin) return cb(null, true);
  if (origin === CLIENT_ORIGIN) return cb(null, true);
  if (/^http:\/\/localhost:\d+$/.test(origin)) return cb(null, true);
  cb(new Error(`CORS: origin ${origin} not allowed`));
};
app.use(cors({ origin: corsAllow, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "eventra-server" });
});

app.use("/api/activity", activityRouter);
app.use("/api/bets", betsRouter);
app.use("/api/markets", marketsRouter);
app.use("/api/posts", postsRouter);
app.use("/api/users", usersRouter);
app.use("/api/wallet", walletRouter);

app.listen(PORT, () => {
  console.log(`[eventra-server] listening on http://localhost:${PORT}`);
  console.log(`[eventra-server] CORS origin: ${CLIENT_ORIGIN}`);
  if (process.env.PRICE_TICK_ENABLED !== "false") {
    startPriceTicker();
  } else {
    console.log("[eventra-server] price ticker disabled (PRICE_TICK_ENABLED=false)");
  }
  if (process.env.BOT_TRADER_ENABLED !== "false") {
    startBotTrader();
  } else {
    console.log("[eventra-server] bot trader disabled (BOT_TRADER_ENABLED=false)");
  }
});
