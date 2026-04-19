import { Route, Routes } from "react-router-dom";
import AccountPage from "./pages/AccountPage";
import AdminPage from "./pages/AdminPage";
import EventsPage from "./pages/EventsPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import SocialPage from "./pages/SocialPage";
import WalletPage from "./pages/WalletPage";

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/social" element={<SocialPage />} />
      <Route path="/account" element={<AccountPage />} />
      <Route path="/wallet" element={<WalletPage />} />
      <Route path="/admin" element={<AdminPage />} />
    </Routes>
  );
}
