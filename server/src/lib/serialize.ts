import { Timestamp } from "firebase-admin/firestore";

function normalizeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (v instanceof Timestamp) {
    return { seconds: v.seconds, nanoseconds: v.nanoseconds };
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if ("_seconds" in obj && "_nanoseconds" in obj) {
      return { seconds: obj._seconds, nanoseconds: obj._nanoseconds };
    }
    if (Array.isArray(v)) return v.map(normalizeValue);
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(obj)) {
      out[k] = normalizeValue(val);
    }
    return out;
  }
  return v;
}

export function serializeDoc<T extends Record<string, unknown>>(data: T | undefined): T {
  if (!data) return {} as T;
  return normalizeValue(data) as T;
}
