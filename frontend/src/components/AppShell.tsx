import { useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity, BarChart3, Inbox, LayoutDashboard, LogOut, Mail, Menu, Plus, Send, Server,
} from "lucide-react";
import { ApiError, apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import type { InboxCounts, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 group", className)} data-testid="brand-logo">
      <span className="relative grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 shadow-lg shadow-blue-900/40 transition-transform duration-200 group-hover:-rotate-6">
        <Send className="size-4 text-white" strokeWidth={2.5} />
      </span>
      <span className="font-heading text-[17px] font-bold tracking-tight text-white">
        Outreach<span className="text-cyan">Forge</span>
      </span>
    </Link>
  );
}

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" },
  { to: "/campaigns", label: "Campaigns", icon: Mail, id: "campaigns" },
  { to: "/inbox", label: "Master Inbox", icon: Inbox, id: "inbox" },
  { to: "/senders", label: "Sender Accounts", icon: Server, id: "senders" },
  { to: "/activity", label: "Activity Log", icon: Activity, id: "activity" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, id: "analytics" },
];

function SideNav({ user, unread, onNavigate }: { user?: User; unread: number; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo />
      </div>
      <div className="px-3">
        <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">Workspace</p>
        <nav className="space-y-0.5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              onClick={onNavigate}
              data-testid={`nav-${n.id}`}
              className={({ isActive }) =>
                cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  isActive ? "bg-[#1E293B] text-cyan" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100",
                )
              }
            >
              <n.icon className="size-4 shrink-0" />
              <span className="flex-1">{n.label}</span>
              {n.id === "inbox" && unread > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white" data-testid="nav-inbox-unread-count">
                  {unread}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="mt-auto border-t border-[#1E293B] p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-800 text-xs font-bold text-slate-100">
            {(user?.name ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-100" data-testid="current-user-name">{user?.name ?? "—"}</p>
            <p className="truncate text-xs text-slate-500" data-testid="current-user-email">{user?.email ?? ""}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => endSession("/login")} data-testid="logout-button" aria-label="Log out">
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]" data-testid="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false });
  const counts = useQuery({
    queryKey: ["inbox-counts"],
    queryFn: () => apiGet<InboxCounts>("/inbox/counts"),
    enabled: me.isSuccess,
    refetchInterval: 60000,
  });
  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  const unread = counts.data?.unread ?? 0;
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-[#1E293B] bg-sidebar lg:block">
        <SideNav user={me.data} unread={unread} />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SideNav user={me.data} unread={unread} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#1E293B] bg-background/80 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(true)} data-testid="mobile-nav-button">
            <Menu className="size-5" />
          </Button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-400 animate-ping-slow" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="hidden sm:inline" data-testid="engine-status">Sending engine online</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {me.isSuccess && <NotificationBell />}
            <Button size="sm" onClick={() => navigate("/campaigns?new=1")} data-testid="topbar-new-campaign-button">
              <Plus className="size-4" /> New campaign
            </Button>
          </div>
        </header>
        <main className={cn("mx-auto px-4 py-7 sm:px-6", wide ? "max-w-none" : "max-w-7xl")}>{children}</main>
      </div>
      <Toaster richColors />
    </div>
  );
}
