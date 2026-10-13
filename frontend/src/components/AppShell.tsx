import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import {
  Activity, AlertTriangle, BarChart3, BookOpen, ChevronDown, ChevronsUpDown, CornerDownLeft, Inbox, LayoutDashboard, LifeBuoy, LogOut,
  Mail, Menu, Moon, Plus, Search, Send, Server, Settings as SettingsIcon, Sun, Upload, User as UserIcon,
} from "lucide-react";
import { ApiError, apiGet } from "@/lib/api";
import { endSession } from "@/lib/session";
import type { Campaign, InboxCounts, Sender, User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";

export function Logo({ className, to = "/" }: { className?: string; to?: string }) {
  return (
    <Link to={to} className={cn("group flex items-center gap-2.5", className)} data-testid="brand-logo">
      <span className="relative grid size-8 place-items-center rounded-lg bg-gradient-to-br from-blue-600 to-sky-500 shadow-md shadow-blue-600/25 transition-transform duration-200 group-hover:-rotate-6">
        <Send className="size-4 text-white" strokeWidth={2.5} />
      </span>
      <span className="font-heading text-[17px] font-semibold tracking-tight text-foreground">
        Outreach<span className="text-cyan">Forge</span>
      </span>
    </Link>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme !== "light";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className={cn("relative overflow-hidden", className)}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label="Toggle theme"
      data-testid="theme-toggle"
    >
      <Sun className={cn("size-4 transition-[transform,opacity] duration-300", dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
      <Moon className={cn("absolute size-4 transition-[transform,opacity] duration-300", dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
    </Button>
  );
}

const GROUPS = [
  { title: "Overview", items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" }] },
  {
    title: "Outreach",
    items: [
      { to: "/campaigns", label: "Campaigns", icon: Mail, id: "campaigns" },
      { to: "/inbox", label: "Master Inbox", icon: Inbox, id: "inbox" },
      { to: "/bounces", label: "Bounces", icon: AlertTriangle, id: "bounces" },
      { to: "/senders", label: "Sender Accounts", icon: Server, id: "senders" },
    ],
  },
  {
    title: "Insights",
    items: [
      { to: "/activity", label: "Activity Log", icon: Activity, id: "activity" },
      { to: "/analytics", label: "Analytics", icon: BarChart3, id: "analytics" },
    ],
  },
];
const ALL_NAV = GROUPS.flatMap((g) => g.items);

function SideNav({ user, unread, senders, onNavigate }: { user?: User; unread: number; senders: Sender[]; onNavigate?: () => void }) {
  const navigate = useNavigate();
  const cap = senders.reduce((a, s) => a + s.effective_limit, 0);
  const used = senders.reduce((a, s) => a + s.sent_today, 0);
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-5"><Logo to="/dashboard" /></div>
      <div className="px-3">
        <button type="button" onClick={() => { navigate("/settings"); onNavigate?.(); }} aria-label="Open workspace and account settings" className="group flex w-full items-center gap-2.5 rounded-lg border border-border bg-panel px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" data-testid="workspace-switcher">
          <span className="grid size-7 place-items-center rounded-md bg-gradient-to-br from-zinc-700 to-zinc-900 text-[11px] font-bold text-white">
            {(user?.name ?? "W").slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{user ? `${user.name.split(" ")[0]}'s workspace` : "Workspace"}</p>
          </div>
          <ChevronsUpDown className="size-3.5 text-muted-foreground transition-colors group-hover:text-foreground" />
        </button>
      </div>
      <nav className="mt-4 flex-1 space-y-5 overflow-y-auto px-3 scroll-thin">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <p className="px-2.5 pb-1.5 text-[11px] font-medium text-muted-foreground/80">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={onNavigate}
                  data-testid={`nav-${n.id}`}
                  className={({ isActive }) =>
                    cn(
                      "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] font-medium transition-colors duration-150",
                      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-primary" />}
                      <n.icon className={cn("size-4 shrink-0", isActive && "text-primary")} />
                      <span className="flex-1">{n.label}</span>
                      {n.id === "inbox" && unread > 0 && (
                        <span className="rounded-full bg-blue-600 px-1.5 py-px font-mono text-[10px] font-semibold text-white" data-testid="nav-inbox-unread-count">{unread}</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-2 p-3">
        <div className="rounded-lg border border-border bg-panel p-3" data-testid="sidebar-usage-card">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Today's sending</span>
            <span className="font-mono text-muted-foreground">{used}/{cap}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-sky-400 transition-[width] duration-500" style={{ width: `${cap ? Math.min(100, (used / cap) * 100) : 0}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{senders.length} inbox{senders.length === 1 ? "" : "es"} connected</p>
        </div>
        <a href="mailto:support@outreachforge.io" className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground" data-testid="nav-support">
          <LifeBuoy className="size-4" /> Help & support
        </a>
      </div>
    </div>
  );
}

function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const camps = useQuery({ queryKey: ["campaigns"], queryFn: () => apiGet<Campaign[]>("/campaigns"), enabled: open });
  const items = useMemo(() => {
    const base = [
      ...ALL_NAV.map((n) => ({ id: n.id, label: n.label, hint: "Go to", to: n.to, icon: n.icon })),
      { id: "new-campaign", label: "Create campaign", hint: "Action", to: "/campaigns?new=1", icon: Plus },
      { id: "connect-inbox", label: "Connect sender inbox", hint: "Action", to: "/senders?connect=1", icon: Server },
      ...(camps.data ?? []).map((c) => ({ id: c.id, label: c.name, hint: "Campaign", to: `/campaigns/${c.id}`, icon: Mail })),
    ];
    const t = q.trim().toLowerCase();
    return t ? base.filter((i) => i.label.toLowerCase().includes(t)) : base;
  }, [q, camps.data]);
  const go = (to: string) => { onOpenChange(false); setQ(""); navigate(to); };
  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQ(""); }}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl animate-slide-down" data-testid="command-palette">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setIdx(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(items.length - 1, i + 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              if (e.key === "Enter" && items[idx]) go(items[idx].to);
            }}
            placeholder="Search pages, campaigns, actions…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            data-testid="command-palette-input"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <ul className="max-h-80 overflow-y-auto p-1.5 scroll-thin">
          {items.map((it, i) => (
            <li key={it.id}>
              <button
                type="button"
                onMouseEnter={() => setIdx(i)}
                onClick={() => go(it.to)}
                className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors", i === idx ? "bg-secondary text-foreground" : "text-foreground/80")}
                data-testid={`command-item-${it.id}`}
              >
                <it.icon className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{it.label}</span>
                <span className="text-[11px] text-muted-foreground">{it.hint}</span>
                {i === idx && <CornerDownLeft className="size-3.5 text-muted-foreground" />}
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">No results for "{q}"</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: string }) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between animate-fade-up">
      <div>
        {eyebrow && <p className="mb-1.5 text-xs font-medium text-primary">{eyebrow}</p>}
        <h1 className="font-heading text-2xl font-semibold text-foreground sm:text-[28px]" data-testid="page-title">{title}</h1>
        {subtitle && <div className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export default function AppShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  const [open, setOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const loc = useLocation();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false });
  const counts = useQuery({ queryKey: ["inbox-counts"], queryFn: () => apiGet<InboxCounts>("/inbox/counts"), enabled: me.isSuccess, refetchInterval: 60000 });
  const senders = useQuery({ queryKey: ["senders"], queryFn: () => apiGet<Sender[]>("/senders"), enabled: me.isSuccess });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  if (me.error instanceof ApiError && me.error.status === 401) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  const unread = counts.data?.unread ?? 0;
  const senderList = senders.isError ? [] : senders.data ?? [];
  const current = ALL_NAV.find((n) => loc.pathname.startsWith(n.to));
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-sidebar-border bg-sidebar lg:block">
        <SideNav user={me.data} unread={unread} senders={senderList} />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SideNav user={me.data} unread={unread} senders={senderList} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/75 px-4 backdrop-blur-xl sm:px-6">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setOpen(true)} data-testid="mobile-nav-button"><Menu className="size-5" /></Button>
          <div className="hidden items-center gap-1.5 text-sm md:flex">
            <span className="text-muted-foreground">Workspace</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground" data-testid="breadcrumb-current">{current?.label ?? "Home"}</span>
          </div>
          <button
            type="button"
            onClick={() => setPalette(true)}
            className="ml-auto flex h-8 w-full max-w-64 items-center gap-2 rounded-md border border-border bg-panel px-2.5 text-sm text-muted-foreground transition-colors hover:border-input hover:text-foreground md:ml-6"
            data-testid="command-palette-trigger"
          >
            <Search className="size-3.5" /><span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-border bg-secondary px-1.5 font-mono text-[10px]">⌘K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 xl:flex" data-testid="engine-status">
              <span className="relative flex size-1.5"><span className="absolute inline-flex size-full rounded-full bg-emerald-400 animate-ping-slow" /><span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" /></span>
              Engine online
            </span>
            <ThemeToggle />
            {me.isSuccess && <NotificationBell />}
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button size="sm" className="ml-1 gap-1" data-testid="topbar-create-menu" />}>
                <Plus className="size-4" /> Create <ChevronDown className="size-3.5 opacity-70" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 animate-slide-down">
                <DropdownMenuItem onClick={() => navigate("/campaigns?new=1")} data-testid="topbar-new-campaign-button"><Mail className="size-4" />New campaign</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/senders?connect=1")} data-testid="topbar-connect-inbox"><Server className="size-4" />Connect inbox</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/campaigns")} data-testid="topbar-import-leads"><Upload className="size-4" />Import leads</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger render={<button type="button" className="ml-1 grid size-8 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-sky-500 text-xs font-semibold text-white ring-2 ring-background transition-transform hover:scale-105" data-testid="user-menu-trigger" />}>
                {(me.data?.name ?? "?").slice(0, 1).toUpperCase()}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 animate-slide-down">
                <DropdownMenuGroup>
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium text-foreground" data-testid="current-user-name">{me.data?.name ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground" data-testid="current-user-email">{me.data?.email ?? ""}</p>
                </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/senders")}><UserIcon className="size-4" />Sender accounts</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")} data-testid="user-menu-settings"><SettingsIcon className="size-4" />Account settings</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")} data-testid="user-menu-theme">
                  {resolvedTheme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}{resolvedTheme === "light" ? "Dark mode" : "Light mode"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/")}><BookOpen className="size-4" />Product overview</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => endSession("/login")} data-testid="logout-button"><LogOut className="size-4" />Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className={cn("mx-auto px-4 py-8 sm:px-8", wide ? "max-w-none" : "max-w-[1320px]")}>{children}</main>
      </div>
      <CommandPalette open={palette} onOpenChange={setPalette} />
      <Toaster richColors />
    </div>
  );
}
