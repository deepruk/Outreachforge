import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import Home from "@/pages/Home";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Campaigns from "@/pages/Campaigns";
import CampaignDetail from "@/pages/CampaignDetail";
import MasterInbox from "@/pages/MasterInbox";
import Bounces from "@/pages/Bounces";
import SenderAccounts from "@/pages/SenderAccounts";
import Analytics from "@/pages/Analytics";
import ActivityLog from "@/pages/ActivityLog";
import Settings from "@/pages/Settings";
import AIWriter from "@/pages/AIWriter";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsOfService from "@/pages/TermsOfService";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  const { pathname } = useLocation();

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/campaigns/:id" element={<CampaignDetail />} />
        <Route path="/inbox" element={<MasterInbox />} />
        <Route path="/bounces" element={<Bounces />} />
        <Route path="/senders" element={<SenderAccounts />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/ai-writer" element={<AIWriter />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {pathname === "/" && (
        <footer className="border-t border-border bg-background px-5 py-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <span>© {new Date().getFullYear()} OutreachForge</span>
            <nav aria-label="Legal" className="flex gap-5">
              <Link to="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link>
              <Link to="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link>
            </nav>
          </div>
        </footer>
      )}
    </>
  );
}
