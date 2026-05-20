// Each share moves the bought side by 0.1 percentage points,
// capped at 5 percentage points per trade. yesPrice + noPrice always sum to 1.
export function applyTradeImpact(
  yesPrice: number,
  side: "yes" | "no",
  shares: number
): { yesPrice: number; noPrice: number } {
  const impact = Math.min(shares * 0.001, 0.05);
  const delta = side === "yes" ? impact : -impact;
  const ny = Math.max(0.03, Math.min(0.97, parseFloat((yesPrice + delta).toFixed(2))));
  return { yesPrice: ny, noPrice: parseFloat((1 - ny).toFixed(2)) };
}
