# Firebase setup for Eventra

Eventra uses **Firebase Authentication** for account creation, login, and delete account. No separate database is required for basic auth; Firebase Auth stores user accounts.

## 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** (or use an existing project).
3. Follow the steps (Google Analytics optional).

## 2. Enable Email/Password sign-in

1. In the project, go to **Build** → **Authentication** → **Get started**.
2. Open the **Sign-in method** tab.
3. Click **Email/Password**, enable it, and save.

## 3. Get your config

1. Click the **gear** (Project settings) next to “Project Overview”.
2. Under **Your apps**, click the **</>** (Web) icon to add a web app if you haven’t already.
3. Copy the `firebaseConfig` object.

## 4. Configure Eventra

Open **`firebase-config.js`** and replace the placeholder values with your config:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

Do **not** commit real API keys to a public repo. For production, use environment variables or a backend.

## 5. Run the app

Serve the project over HTTP (e.g. with a local server). Firebase Auth may not work from `file://`.

- From the project folder: `npx serve .` or `python -m http.server 8000`
- Open `http://localhost:3000` (or 8000) and use **Log in**, **Sign up**, and **Account** → **Delete account**.

## Pages and navigation

| Page          | Purpose                          |
|---------------|-----------------------------------|
| `index.html`  | Homepage; nav shows Log in / Sign up or Account when signed in |
| `login.html`  | Email/password login              |
| `signup.html`  | Create account (email, password, optional display name) |
| `account.html`| Profile, security, notifications, **Delete account** (requires re-auth) |

Navigation is shared: **Markets** and **Account** link across pages; **Log in** / **Sign up** appear when signed out, **Account** / **Profile** when signed in.

---

## Fixing "auth/configuration-not-found"

This error means Firebase Authentication is not fully set up for your project. Do this **in order**:

### 1. Turn on Authentication

1. Open [Firebase Console](https://console.firebase.google.com/) and select the **Eventra** project (e.g. `eventra-101da`).
2. In the left sidebar go to **Build** → **Authentication**.
3. If you see **"Get started"**, click it.
4. Go to the **Sign-in method** tab.
5. Click **Email/Password**.
6. Turn **Enable** ON, then click **Save**.

### 2. Check authorized domains

1. Still in **Authentication**, open the **Settings** tab (or the **"Authorized domains"** section).
2. Make sure **localhost** is in the list so sign-up works when you run the app locally.

### 3. Confirm your web app config

1. Click the **gear** (Project settings) next to "Project Overview".
2. Under **Your apps**, you should see a **Web** app (e.g. "Eventra").
3. Your `firebase-config.js` values should match the config shown there (same `projectId`, `authDomain`, etc.).

After enabling Email/Password and saving, try **Sign up** again. If the error persists, do a hard refresh (Ctrl+Shift+R) or restart your local server.
