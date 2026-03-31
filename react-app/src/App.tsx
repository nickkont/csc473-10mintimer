import { Navigate, Route, Routes } from "react-router-dom";
import EventsPage from "./pages/EventsPage";
import SocialPage from "./pages/SocialPage";
import AccountPage from "./pages/AccountPage";

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/events" replace />} />
      <Route path="/events" element={<EventsPage />} />
      <Route path="/social" element={<SocialPage />} />
      <Route path="/account" element={<AccountPage />} />
    </Routes>
  );
}
