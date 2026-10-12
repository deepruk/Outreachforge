import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import MasterInbox from "@/pages/MasterInbox";
import SenderAccounts from "@/pages/SenderAccounts";
import Analytics from "@/pages/Analytics";
import ActivityLog from "@/pages/ActivityLog";
import Settings from "@/pages/Settings";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/signup" element={<AuthPage mode="signup" />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/campaigns" element={<Campaigns />} />
      <Route path="/campaigns/:id" element={<CampaignDetail />} />
      <Route path="/inbox" element={<MasterInbox />} />
      <Route path="/senders" element={<SenderAccounts />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/activity" element={<ActivityLog />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
