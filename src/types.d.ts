/**
 * Eventra — Global type declarations
 */

declare const firebase: any;

interface FirebaseUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

type DemoUser = FirebaseUser;

interface AuthResult {
  user: FirebaseUser;
}

interface ProfileData {
  firstName: string;
  lastName: string;
  username: string;
  phone: string;
  dob: string;
  timezone: string;
  language: string;
  bio: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  balance: number;
  timestamp: any;
}

interface Market {
  id: string;
  title: string;
  category: string;
  closesAt: any;
  status: "open" | "resolved";
  outcome: "yes" | "no" | null;
  yesPrice: number;
  noPrice: number;
  totalTrades: number;
  createdBy: string;
  createdAt: any;
}

interface Position {
  marketId: string;
  yesShares: number;
  noShares: number;
}

interface EventraAuthAPI {
  getAuth(): any;
  getCurrentUser(): FirebaseUser | null;
  onAuthStateChanged(callback: (user: FirebaseUser | null) => void): () => void;
  signUp(email: string, password: string, displayName?: string | null): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  deleteAccount(): Promise<void>;
  reauthenticate(password: string): Promise<void>;
}

interface Window {
  EventraAuth: EventraAuthAPI;
  strength: (val: string) => void;
}
