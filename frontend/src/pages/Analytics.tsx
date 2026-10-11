import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Eye, MessageSquareReply, MousePointerClick, Send, ShieldAlert, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Analytics as AnalyticsData } from "@/lib/types";
import { CAMPAIGN_STATUS, fmt, pctFmt } from "@/lib/format";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Panel, PerformanceChart, Pill, SeriesToggles, StatCard, type SeriesKey } from "@/components/ui-kit";
import { cn } from "@/lib/utils";

const RANGES = [7, 14, 30, 90];

export default function Analytics() {
  const [days, setDays] = useState(30);
  const [visible, setVisible] = useState<SeriesKey[]>(["sent", "opened", "clicked", "replied"]);
  const a = useQuery({ queryKey: ["analytics", days], queryFn: () => apiGet<AnalyticsData>(`/analytics?days=${days}`) });
  const d = a.isError ? undefined : a.data;
  const t = d?.totals;
  const v = (n?: number) => (n === undefined ? "—" : fmt(n));
  const funnel = t
    ? [
        { stage: "Contacted", value: t.contacted },
        { stage: "Opened", value: t.opened },
        { stage: "Clicked", value: t.clicked },
        { stage: "Replied", value: t.replied },
      ]
    : [];

  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        subtitle="Unique opens, clicks and replies per contacted lead."
        actions={
          <div className="flex gap-1 rounded-lg border border-[#1E293B] bg-panel p-1">
            {RANGES.map((r) => (
              <button key={r} onClick={() => setDays(r)} data-testid={`analytics-range-${r}`}
                className={cn("rounded-md px-3 py-1.5 font-mono text-xs transition-colors duration-150", days === r ? "bg-[#1E293B] text-white" : "text-slate-400 hover:text-slate-200")}>
                {r}d
              </button>
            ))}
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard testId="analytics-kpi-sent" label="Sent" value={v(t?.sent)} icon={Send} />
        <StatCard testId="analytics-kpi-leads" label="Total leads" value={v(t?.leads)} icon={Users} />
        <StatCard testId="analytics-kpi-open-rate" label="Open rate" value={t ? pctFmt(t.open_rate) : "—"} icon={Eye} sub={`${v(t?.opened)} opens`} />
        <StatCard testId="analytics-kpi-click-rate" label="Click rate" value={t ? pctFmt(t.click_rate) : "—"} icon={MousePointerClick} accent="text-amber-300" sub={`${v(t?.clicked)} clicks`} />
        <StatCard testId="analytics-kpi-reply-rate" label="Reply rate" value={t ? pctFmt(t.reply_rate) : "—"} icon={MessageSquareReply} accent="text-emerald-300" sub={`${v(t?.replied)} replies`} />
        <StatCard testId="analytics-kpi-bounce-rate" label="Bounce rate" value={t ? pctFmt(t.bounce_rate) : "—"} icon={ShieldAlert} accent="text-red-300" sub={`${v(t?.bounced)} bounced`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-8" title="Activity over time" action={<SeriesToggles visible={visible} onChange={setVisible} />} testId="analytics-chart-panel">
          <div className="p-4">{d ? <PerformanceChart data={d.series} visible={visible} height={300} /> : <div className="h-[300px] animate-pulse rounded-lg bg-[#161F30]" />}</div>
        </Panel>
        <Panel className="lg:col-span-4" title="Engagement funnel" testId="analytics-funnel-panel">
          <div className="h-[300px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid stroke="#1E293B" horizontal={false} />
                <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="stage" stroke="#94A3B8" fontSize={12} tickLine={false} axisLine={false} width={74} />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, fontSize: 12 }} />
                <Bar dataKey="value" name="Leads" fill="#2563EB" radius={[0, 6, 6, 0]} barSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Campaign comparison" testId="analytics-campaigns-panel">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm" data-testid="analytics-campaigns-table">
            <thead className="text-left text-[11px] uppercase tracking-[0.07em] text-slate-500">
              <tr className="border-b border-[#1E293B]">
                {["Campaign", "Status", "Leads", "Sent", "Open rate", "Click rate", "Reply rate", "Bounce"].map((h, i) => (
                  <th key={h} className={cn("px-5 py-2.5 font-semibold", i > 1 && "text-right")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono">
              {(d?.campaigns ?? []).map((c) => (
                <tr key={c.id} className="border-b border-[#1E293B]/70 transition-colors hover:bg-white/[0.02]" data-testid={`analytics-campaign-row-${c.id}`}>
                  <td className="px-5 py-3 font-sans"><Link to={`/campaigns/${c.id}`} className="font-medium text-slate-100 hover:text-cyan">{c.name}</Link></td>
                  <td className="px-5 py-3 font-sans"><Pill cls={CAMPAIGN_STATUS[c.status].cls} dot={CAMPAIGN_STATUS[c.status].dot}>{CAMPAIGN_STATUS[c.status].label}</Pill></td>
                  <td className="px-5 py-3 text-right text-slate-300">{fmt(c.stats.leads)}</td>
                  <td className="px-5 py-3 text-right text-slate-300">{fmt(c.stats.sent)}</td>
                  <td className="px-5 py-3 text-right text-sky-300">{pctFmt(c.stats.open_rate)}</td>
                  <td className="px-5 py-3 text-right text-amber-300">{pctFmt(c.stats.click_rate)}</td>
                  <td className="px-5 py-3 text-right text-emerald-300">{pctFmt(c.stats.reply_rate)}</td>
                  <td className="px-5 py-3 text-right text-red-300">{pctFmt(c.stats.bounce_rate)}</td>
                </tr>
              ))}
              {d && d.campaigns.length === 0 && <tr><td colSpan={8} className="px-5 py-10 text-center font-sans text-slate-500">No campaigns yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
