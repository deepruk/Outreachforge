import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, MailCheck, Send, Timer } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { ActivityData, Campaign } from "@/lib/types";
import { SENDER_STATUS, fmt, timeAgo } from "@/lib/format";
import AppShell, { PageHeader } from "@/components/AppShell";
import { EmptyState, Panel, Pill, RateBar, StatCard } from "@/components/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

function useNow(ms = 1000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setT(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return t;
}

function countdown(iso: string | null, nowMs: number): string | null {
  if (!iso) return null;
  const secs = Math.round((new Date(iso).getTime() - nowMs) / 1000);
  if (secs <= 0) return null;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h ? `${h}h ${m}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });

export default function ActivityLog() {
  const [campaign, setCampaign] = useState("all");
  const nowMs = useNow();
  const camps = useQuery({ queryKey: ["campaigns"], queryFn: () => apiGet<Campaign[]>("/campaigns") });
  const q = useQuery({
    queryKey: ["activity", campaign],
    queryFn: () => apiGet<ActivityData>(`/activity?limit=100${campaign !== "all" ? `&campaign_id=${campaign}` : ""}`),
    refetchInterval: 10000,
  });
  const d = q.isError ? undefined : q.data;
  const nextInbox = (d?.inboxes ?? []).filter((i) => i.next_available_at).sort((a, b) => a.next_available_at!.localeCompare(b.next_available_at!))[0];
  const ready = (d?.inboxes ?? []).filter((i) => !i.next_available_at && i.sent_today < i.effective_limit && (i.status === "active" || i.status === "demo")).length;
  const campName = (id: string) => (id === "all" ? "All campaigns" : camps.data?.find((c) => c.id === id)?.name ?? "Campaign");

  return (
    <AppShell>
      <PageHeader
        title="Activity Log"
        subtitle={<span className="flex items-center gap-2"><span className="relative flex size-2"><span className="absolute inline-flex size-full rounded-full bg-emerald-400 animate-ping-slow" /><span className="relative inline-flex size-2 rounded-full bg-emerald-400" /></span>Live feed of every email sent — refreshes every 10 seconds.</span>}
        actions={
          <Select value={campaign} onValueChange={(v: string) => setCampaign(v || "all")}>
            <SelectTrigger className="w-60" data-testid="activity-campaign-filter"><SelectValue>{(v) => campName(v as string)}</SelectValue></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All campaigns</SelectItem>
              {(camps.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard testId="activity-kpi-hour" label="Sent last hour" value={d ? fmt(d.sent_last_hour) : "—"} icon={Send} />
        <StatCard testId="activity-kpi-ready" label="Inboxes ready now" value={d ? `${ready}/${d.inboxes.length}` : "—"} icon={MailCheck} accent="text-emerald-300" />
        <StatCard testId="activity-kpi-next" label="Next inbox frees up" value={nextInbox ? countdown(nextInbox.next_available_at, nowMs) ?? "now" : ready ? "now" : "—"} sub={nextInbox?.email} icon={Timer} />
        <StatCard testId="activity-kpi-upcoming" label="Queued leads" value={d ? fmt(d.upcoming.length) : "—"} sub="next due in active campaigns" icon={Clock} />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Sent emails" action={<span className="font-mono text-xs text-muted-foreground">{d?.items.length ?? 0} latest</span>} testId="activity-feed-panel">
          {d && d.items.length === 0 ? (
            <div className="p-5"><EmptyState icon={Activity} testId="activity-empty" title="Nothing sent yet" body="Once a campaign is launched, every email the engine sends shows up here in real time." /></div>
          ) : (
            <ol className="max-h-[calc(100vh-20rem)] min-h-[300px] overflow-y-auto scroll-thin" data-testid="activity-feed">
              {(d?.items ?? []).map((it, i) => (
                <li key={it.id} className="relative flex gap-4 border-b border-border/60 px-5 py-3 transition-colors hover:bg-foreground/[0.02] animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }} data-testid={`activity-item-${it.id}`}>
                  <div className="w-16 shrink-0 pt-0.5 text-right">
                    <p className="font-mono text-[11px] text-foreground/75">{clock(it.sent_at)}</p>
                    <p className="font-mono text-[10px] text-muted-foreground/70">{timeAgo(it.sent_at)}</p>
                  </div>
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", it.replied ? "bg-emerald-400" : it.bounced ? "bg-red-400" : it.clicked ? "bg-amber-400" : it.opened ? "bg-sky-400" : "bg-blue-600")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">
                      <span className="font-mono text-cyan">{it.sender_email}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className="font-medium">{it.lead_name || it.to_email}</span>
                      {it.lead_name && <span className="font-mono text-xs text-muted-foreground"> {it.to_email}</span>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{it.subject}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Link to={`/campaigns/${it.campaign_id}`} className="text-[11px] text-muted-foreground hover:text-cyan">{it.campaign_name}</Link>
                      <Pill cls="border-border bg-secondary text-muted-foreground">Step {it.step}{it.variant === "b" ? " · B" : ""}</Pill>
                      {it.opened && <Pill cls="border-sky-500/30 bg-sky-500/10 text-sky-300">{it.open_count > 0 ? `Opened ${it.open_count}×` : "Opened"}</Pill>}
                      {it.clicked && <Pill cls="border-amber-500/30 bg-amber-500/10 text-amber-300">Clicked</Pill>}
                      {it.replied && <Pill cls="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Replied</Pill>}
                      {it.bounced && <Pill cls="border-red-500/30 bg-red-500/10 text-red-300">Bounced</Pill>}
                    </div>
                  </div>
                </li>
              ))}
              {!d && Array.from({ length: 6 }).map((_, i) => <li key={i} className="m-3 h-12 animate-pulse rounded-lg bg-muted" />)}
            </ol>
          )}
        </Panel>

        <div className="space-y-6 lg:col-span-4">
          <Panel title="Inbox schedule" testId="activity-inboxes-panel">
            <ul className="divide-y divide-border">
              {(d?.inboxes ?? []).map((ib) => {
                const cd = countdown(ib.next_available_at, nowMs);
                const full = ib.sent_today >= ib.effective_limit;
                return (
                  <li key={ib.id} className="px-5 py-3.5" data-testid={`activity-inbox-${ib.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-mono text-xs text-foreground/90">{ib.email}</p>
                      <Pill cls={SENDER_STATUS[ib.status].cls}>{SENDER_STATUS[ib.status].label}</Pill>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Last sent {timeAgo(ib.last_sent_at)}</span>
                      <span className={cn("font-mono", full ? "text-amber-300" : cd ? "text-cyan" : "text-emerald-300")} data-testid={`activity-inbox-next-${ib.id}`}>
                        {ib.status === "paused" || ib.status === "error" ? "not sending" : full ? "limit reached" : cd ? `next in ${cd}` : "ready"}
                      </span>
                    </div>
                    <div className="mt-2"><RateBar value={(ib.sent_today / Math.max(1, ib.effective_limit)) * 100} color={full ? "bg-amber-400" : "bg-cyan-500"} /></div>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">{ib.sent_today}/{ib.effective_limit} today</p>
                  </li>
                );
              })}
            </ul>
          </Panel>
          <Panel title="Up next" testId="activity-upcoming-panel">
            <ul className="divide-y divide-border">
              {(d?.upcoming ?? []).map((u, i) => {
                const cd = countdown(u.due_at, nowMs);
                return (
                  <li key={`${u.lead_email}-${i}`} className="flex items-center justify-between gap-3 px-5 py-2.5" data-testid={`activity-upcoming-${i}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground/90">{u.lead_name || u.lead_email}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{u.campaign_name} · step {u.step}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{cd ? `in ${cd}` : "due now"}</span>
                  </li>
                );
              })}
              {d && d.upcoming.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No queued leads in active campaigns.</li>}
            </ul>
            <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">"Due now" leads go out as soon as an inbox is ready, inside the sending window, gap and daily-start rules.</p>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
