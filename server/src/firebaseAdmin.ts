import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import admin from "firebase-admin";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ?? "./serviceAccount.json";
const serviceAccount = JSON.parse(readFileSync(resolve(credPath), "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
export { admin };
