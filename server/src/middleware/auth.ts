import type { NextFunction, Request, Response } from "express";
import { adminAuth, adminDb } from "../firebaseAdmin.js";

declare module "express-serve-static-core" {
  interface Request {
    uid?: string;
    email?: string | null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Missing Authorization header" });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.uid = decoded.uid;
    req.email = decoded.email ?? null;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.uid) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const snap = await adminDb.doc(`users/${req.uid}`).get();
    const role = snap.exists ? String(snap.data()?.role ?? "") : "";
    if (role !== "admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: "Failed to verify admin role" });
  }
}
