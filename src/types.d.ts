/**
 * Eventra — Global type declarations
 * Ambient declarations shared across all TypeScript source files.
 */

interface DemoUser {
  uid: string;
  email: string;
  password: string;
  displayName: string;
}

interface AuthResult {
  user: DemoUser;
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

interface EventraAuthAPI {
  getAuth(): null;
  getCurrentUser(): DemoUser | null;
  onAuthStateChanged(callback: (user: DemoUser | null) => void): () => void;
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
