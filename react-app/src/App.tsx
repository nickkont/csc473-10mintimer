import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import ClaimAdminPage from "./pages/ClaimAdminPage";
import ErrorBoundary from "./components/ErrorBoundary";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import EventsPage from "./pages/EventsPage";
import HomePage from "./pages/HomePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import LoginPage from "./pages/LoginPage";
import MarketDetailPage from "./pages/MarketDetailPage";
import ProfilePage from "./pages/ProfilePage";
import SignupPage from "./pages/SignupPage";
import SocialPage from "./pages/SocialPage";
import WalletPage from "./pages/WalletPage";
import { useBotEngine } from "./hooks/useBotEngine";

function ScrollToTop(): null {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function BotEngine(): null {
  useBotEngine();
  return null;
}

export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <BotEngine />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/events/:marketId" element={<MarketDetailPage />} />
        <Route path="/social" element={<SocialPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/account/:uid" element={<AccountPage />} />
        <Route path="/profile/:uid" element={<ProfilePage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/claim-admin" element={<ClaimAdminPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
