# Eventra API server

Express + Node.js API server. Owns the authoritative mutations for Eventra (bets, wallet, market resolution) so they can't be tampered with from the browser. Verifies Firebase Auth ID tokens and writes to Firestore via the Firebase Admin SDK.

## Setup

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Get a Firebase Admin service account

1. Open the [Firebase Console](https://console.firebase.google.com/) → **eventra-101da**.
2. Project settings (gear icon) → **Service accounts** tab.
3. Click **Generate new private key**. Download the JSON.
4. Save the file as `server/serviceAccount.json` (gitignored).

### 3. Create `.env`

```bash
cp .env.example .env
```

Defaults are fine for local dev.

### 4. Run

```bash
npm run dev
```

Server listens on `http://localhost:4000`. Hit `http://localhost:4000/api/health` to confirm.

## Running with the React app

In one terminal:

```bash
cd server && npm run dev
```

In another:

```bash
cd react-app && npm run dev
```

Vite (port 5173) proxies `/api/*` to the API server on port 4000, so the client calls `/api/bets` transparently in dev.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | — | Liveness check. |
| POST | `/api/bets` | Bearer ID token | Atomically debit wallet, update position, increment market trades. Body: `{ marketId, side: "yes"|"no", shares }`. |

More endpoints (`/api/markets`, `/api/wallet/*`, `/api/users/:uid`, `POST /api/markets/:id/resolve`) coming in the next slice.

## Why the server exists

The grading rubric requires that "most of the work be done on the API server" and that graders be able to confirm this by reading the code. More importantly: with the prior architecture, a user could open DevTools and edit their own `walletBalance` document in Firestore. The API server is the only thing that should be allowed to write to `wallets`, `bets`, and `markets` — paired with Firestore Security Rules that deny client writes to those collections.
