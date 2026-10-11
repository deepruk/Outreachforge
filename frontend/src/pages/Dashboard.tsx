import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Eye, Inbox, MessageSquareReply, MousePointerClick, Send, ShieldAlert } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Analytics, Campaign, Sender, Thread } from "@/lib/types";
import { CAMPAIGN_STATUS, THREAD_LABEL, fmt, pctFmt, timeAgo } from "@/lib/format";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Panel, PerformanceChart, Pill, RateBar, SeriesToggles, StatCard, type SeriesKey } from "@/components/ui-kit";

export default function Dashboard() {
  const [visible, setVisible] = useState<SeriesKey[]>(["sent", "opened", "replied"]);
  const a = useQuery({ queryKey: ["analytics", 14], queryFn: () => apiGet<Analytics>("/analytics?days=14") });
  const threads = useQuery({ queryKey: ["threads", "recent"], queryFn: () => apiGet<Thread[]>("/inbox/threads?limit=6") });
  const camps = useQuery({ queryKey: ["campaigns"], queryFn: () => apiGet<Campaign[]>("/campaigns") });
  const senders = useQuery({ queryKey: ["senders"], queryFn: () => apiGet<Sender[]>("/senders") });
  const t = a.isError ? undefined : a.data?.totals;
  const v = (n?: number) => (n === undefined ? "—" : fmt(n));
  const r = (n?: number) => (n === undefined ? "—" : pctFmt(n));

  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle="Last 14 days across all campaigns and inboxes." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard testId="kpi-sent" label="Emails sent" value={v(t?.sent)} icon={Send} sub={`${v(t?.leads)} total leads`} />
        <StatCard testId="kpi-open-rate" label="Open rate" value={r(t?.open_rate)} icon={Eye} sub={`${v(t?.opened)} unique opens`} />
        <StatCard testId="kpi-click-rate" label="Click rate" value={r(t?.click_rate)} icon={MousePointerClick} accent="text-amber-300" sub={`${v(t?.clicked)} clicked`} />
        <StatCard testId="kpi-reply-rate" label="Reply rate" value={r(t?.reply_rate)} icon={MessageSquareReply} accent="text-emerald-300" sub={`${v(t?.replied)} replies`} />
        <StatCard testId="kpi-bounce-rate" label="Bounce rate" value={r(t?.bounce_rate)} icon={ShieldAlert} accent="text-red-300" sub={`${v(t?.bounced)} bounced`} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Outreach performance" action={<SeriesToggles visible={visible} onChange={setVisible} />} testId="dashboard-chart-panel">
          <div className="p-4">
            {a.data && !a.isError ? <PerformanceChart data={a.data.series} visible={visible} height={440} /> : <div className="h-[440px] animate-pulse rounded-lg bg-[#161F30]" />}
          </div>
        </Panel>
        <Panel
          className="lg:col-span-4"
          title="Latest replies"
          action={<Link to="/inbox" className="flex items-center gap-1 text-xs text-cyan hover:underline" data-testid="dashboard-open-inbox-link">Master Inbox <ArrowUpRight className="size-3" /></Link>}
          testId="dashboard-replies-panel"
        >
          <ul className="divide-y divide-[#1E293B]">
            {(threads.isError ? [] : threads.data ?? []).map((th) => (
              <li key={th.id}>
                <Link to={`/inbox?t=${th.id}`} className="flex gap-3 px-5 py-3 transition-colors hover:bg-white/[0.02]" data-testid={`dashboard-reply-${th.id}`}>
                  <div className="relative grid size-8 shrink-0 place-items-center rounded-full bg-[#1E293B] text-xs font-bold">
                    {th.contact_name[0]?.toUpperCase()}
                    {th.unread && <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-panel bg-blue-500" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-slate-100">{th.contact_name}</p>
                      <span className="shrink-0 font-mono text-[11px] text-slate-500">{timeAgo(th.last_at)}</span>
                    </div>
                    <p className="truncate text-xs text-slate-400">{th.snippet}</p>
                    {th.label !== "none" && <div className="mt-1.5"><Pill cls={THREAD_LABEL[th.label].cls}>{THREAD_LABEL[th.label].label}</Pill></div>}
                  </div>
                </Link>
              </li>
            ))}
            {threads.data && threads.data.length === 0 && (
              <li className="flex flex-col items-center px-5 py-12 text-center text-sm text-slate-500"><Inbox className="mb-2 size-5" />No replies yet</li>
            )}
          </ul>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Panel
          className="lg:col-span-8"
          title="Campaigns"
          action={<Link to="/campaigns" className="text-xs text-cyan hover:underline" data-testid="dashboard-all-campaigns-link">View all</Link>}
          testId="dashboard-campaigns-panel"
        >
          <div className="divide-y divide-[#1E293B]">
            {(camps.isError ? [] : camps.data ?? []).slice(0, 5).map((c) => (
              <Link key={c.id} to={`/campaigns/${c.id}`} className="grid grid-cols-12 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/[0.02]" data-testid={`dashboard-campaign-${c.id}`}>
                <div className="col-span-12 min-w-0 sm:col-span-5">
                  <p className="truncate text-sm font-medium text-slate-100">{c.name}</p>
                  <div className="mt-1"><Pill cls={CAMPAIGN_STATUS[c.status].cls} dot={CAMPAIGN_STATUS[c.status].dot}>{CAMPAIGN_STATUS[c.status].label}</Pill></div>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <p className="mb-1 font-mono text-[11px] text-slate-400">{c.progress.toFixed(0)}% complete</p>
                  <RateBar value={c.progress} />
                </div>
                <div className="col-span-6 grid grid-cols-3 gap-2 text-right font-mono text-xs sm:col-span-4">
                  <span><span className="block text-[10px] uppercase text-slate-500">Open</span>{pctFmt(c.stats.open_rate)}</span>
                  <span><span className="block text-[10px] uppercase text-slate-500">Click</span>{pctFmt(c.stats.click_rate)}</span>
                  <span className="text-emerald-300"><span className="block text-[10px] uppercase text-slate-500">Reply</span>{pctFmt(c.stats.reply_rate)}</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel className="lg:col-span-4" title="Sender health" action={<Link to="/senders" className="text-xs text-cyan hover:underline" data-testid="dashboard-senders-link">Manage</Link>} testId="dashboard-senders-panel">
          <ul className="space-y-4 p-5">
            {(senders.isError ? [] : senders.data ?? []).slice(0, 5).map((s) => (
              <li key={s.id} data-testid={`dashboard-sender-${s.id}`}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-mono text-slate-300">{s.email}</span>
                  <span className="shrink-0 font-mono text-slate-400">{s.sent_today}/{s.daily_limit}</span>
                </div>
                <RateBar value={(s.sent_today / s.daily_limit) * 100} color={s.status === "error" ? "bg-red-500" : "bg-cyan-500"} />
              </li>
            ))}
            {senders.data && senders.data.length === 0 && (
              <li className="text-sm text-slate-500">No sender accounts yet. <Link to="/senders" className="text-cyan">Connect one →</Link></li>
            )}
          </ul>
        </Panel>
      </div>
    </AppShell>
  );
}
