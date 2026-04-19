# Eventra — Prediction Markets

A prediction markets web app built with React + Firebase (Firestore + Auth).

## Tech Stack

- **React 18** with TypeScript (Vite)
- **Firebase Auth** — email/password authentication
- **Cloud Firestore** — markets, trades, wallets, social posts
- **React Router v6** (HashRouter)

## Pages

All pages are React components under `react-app/src/pages/`:

| Page | Route | Description |
|------|-------|-------------|
| `HomePage` | `/` | Marketing landing page with featured markets |
| `LoginPage` | `/login` | Firebase email/password sign-in |
| `SignupPage` | `/signup` | Account creation — writes user doc to Firestore |
| `EventsPage` | `/events` | Browse and trade YES/NO prediction markets |
| `SocialPage` | `/social` | Community feed with real-time Firestore posts |
| `AccountPage` | `/account` | Profile settings, wallet balance, transaction history |
| `WalletPage` | `/wallet` | Deposit/withdraw funds, full transaction table |
| `AdminPage` | `/admin` | Create, resolve, and delete markets (admin role only) |

## Running Locally

```bash
cd react-app
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Building

```bash
cd react-app
npm run build
# output goes to react-dist/
```

Or from the repo root:

```bash
npm run build
```

## Firebase Setup

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for instructions on connecting your own Firebase project.
