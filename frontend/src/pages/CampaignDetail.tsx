import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, Loader2, MessageSquareReply, MousePointerClick, Pause, Play, Send, ShieldAlert, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import type { Analytics, Campaign } from "@/lib/types";
import { CAMPAIGN_STATUS, errMsg, fmt, pctFmt } from "@/lib/format";
import AppShell from "@/components/AppShell";
import { LeadsTab, SequenceTab, SettingsTab } from "@/components/CampaignTabs";
import { Panel, PerformanceChart, Pill, RateBar, SeriesToggles, StatCard, type SeriesKey } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function Overview({ campaign }: { campaign: Campaign }) {
  const [visible, setVisible] = useState<SeriesKey[]>(["sent", "opened", "clicked", "replied"]);
  const a = useQuery({ queryKey: ["campaign-analytics", campaign.id], queryFn: () => apiGet<Analytics>(`/campaigns/${campaign.id}/analytics?days=14`) });
  const t = campaign.stats;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard testId="campaign-kpi-leads" label="Leads" value={fmt(t.leads)} icon={Users} />
        <StatCard testId="campaign-kpi-sent" label="Sent" value={fmt(t.sent)} icon={Send} />
        <StatCard testId="campaign-kpi-open-rate" label="Open rate" value={pctFmt(t.open_rate)} sub={`${t.opened} opened`} icon={Eye} />
        <StatCard testId="campaign-kpi-click-rate" label="Click rate" value={pctFmt(t.click_rate)} sub={`${t.clicked} clicked`} icon={MousePointerClick} accent="text-amber-300" />
        <StatCard testId="campaign-kpi-reply-rate" label="Reply rate" value={pctFmt(t.reply_rate)} sub={`${t.replied} replied`} icon={MessageSquareReply} accent="text-emerald-300" />
        <StatCard testId="campaign-kpi-bounce-rate" label="Bounce rate" value={pctFmt(t.bounce_rate)} sub={`${t.bounced} bounced`} icon={ShieldAlert} accent="text-red-300" />
      </div>
      <Panel title="Daily activity" action={<SeriesToggles visible={visible} onChange={setVisible} />} testId="campaign-chart-panel">
        <div className="p-4">{a.data ? <PerformanceChart data={a.data.series} visible={visible} height={260} /> : <div className="h-[260px] animate-pulse rounded-lg bg-[#161F30]" />}</div>
      </Panel>
      <Panel title="Step performance" testId="campaign-steps-panel">
        <div className="divide-y divide-[#1E293B]">
          {(a.data?.steps ?? []).map((s) => (
            <div key={s.step} className="grid grid-cols-2 items-center gap-4 px-5 py-4 md:grid-cols-12" data-testid={`step-stat-${s.step}`}>
              <div className="col-span-2 min-w-0 md:col-span-4">
                <span className="font-mono text-[11px] uppercase text-cyan">Step {s.step}</span>
                <p className="truncate text-sm text-slate-200">{s.subject || "Same-thread follow-up"}</p>
              </div>
              {([["Sent", s.sent, 100, "bg-blue-500"], ["Opened", s.opened, s.sent ? (s.opened / s.sent) * 100 : 0, "bg-sky-400"],
                ["Clicked", s.clicked, s.sent ? (s.clicked / s.sent) * 100 : 0, "bg-amber-400"], ["Replied", s.replied, s.sent ? (s.replied / s.sent) * 100 : 0, "bg-emerald-400"]] as const).map(([l, v, p, c]) => (
                <div key={l} className="md:col-span-2">
                  <div className="mb-1 flex justify-between font-mono text-xs"><span className="text-slate-500">{l}</span><span className="text-slate-200">{v}</span></div>
                  <RateBar value={p} color={c} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export default function CampaignDetail() {
  const { id = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "overview";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [confirmDel, setConfirmDel] = useState(false);
  const c = useQuery({ queryKey: ["campaign", id], queryFn: () => apiGet<Campaign>(`/campaigns/${id}`), refetchInterval: 30000 });
  const refresh = (data: Campaign) => {
    qc.setQueryData(["campaign", id], data);
    qc.invalidateQueries({ queryKey: ["campaigns"] });
  };
  const launch = useMutation({
    mutationFn: () => apiPost<Campaign>(`/campaigns/${id}/launch`),
    onSuccess: (d) => { refresh(d); toast.success("Campaign launched — the engine will start sending within a minute"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const pause = useMutation({
    mutationFn: () => apiPost<Campaign>(`/campaigns/${id}/pause`),
    onSuccess: (d) => { refresh(d); toast.success("Campaign paused"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: () => apiDelete(`/campaigns/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["campaigns"] }); toast.success("Campaign deleted"); navigate("/campaigns"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const camp = c.isError ? undefined : c.data;
  const st = camp ? CAMPAIGN_STATUS[camp.status] : undefined;

  return (
    <AppShell>
      <Link to="/campaigns" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-white" data-testid="back-to-campaigns-link">
        <ArrowLeft className="size-4" /> Campaigns
      </Link>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-fade-up">
        <div className="min-w-0">
          <h1 className="truncate font-heading text-2xl font-bold text-white sm:text-[28px]" data-testid="campaign-title">{camp?.name ?? (c.isError ? "Campaign unavailable" : "Loading…")}</h1>
          {camp && st && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Pill cls={st.cls} dot={st.dot} testId="campaign-status-badge">{st.label}</Pill>
              <span className="text-xs text-slate-500">{camp.steps.length} steps · {camp.sender_ids.length} inboxes · {camp.progress.toFixed(0)}% complete</span>
            </div>
          )}
        </div>
        {camp && (
          <div className="flex gap-2">
            {camp.status === "active" ? (
              <Button variant="outline" onClick={() => pause.mutate()} disabled={pause.isPending} data-testid="campaign-pause-button">
                {pause.isPending ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />} Pause
              </Button>
            ) : (
              <Button onClick={() => launch.mutate()} disabled={launch.isPending} className="bg-emerald-600 hover:bg-emerald-500" data-testid="campaign-launch-button">
                {launch.isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />} {camp.status === "paused" ? "Resume" : "Launch"}
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setConfirmDel(true)} data-testid="campaign-delete-button" aria-label="Delete campaign">
              <Trash2 className="size-4 text-slate-400" />
            </Button>
          </div>
        )}
      </div>

      {camp && (
        <Tabs value={tab} onValueChange={(v) => setParams({ tab: String(v) })}>
          <TabsList variant="line" className="mb-6 border-b border-[#1E293B] w-full justify-start rounded-none">
            {[["overview", "Overview"], ["leads", `Leads (${camp.stats.leads})`], ["sequence", "Sequence"], ["settings", "Settings"]].map(([k, l]) => (
              <TabsTrigger key={k} value={k} className="flex-none px-4" data-testid={`campaign-tab-${k}`}>{l}</TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="overview" className="animate-fade-up"><Overview campaign={camp} /></TabsContent>
          <TabsContent value="leads" className="animate-fade-up"><LeadsTab campaign={camp} /></TabsContent>
          <TabsContent value="sequence" className="animate-fade-up"><SequenceTab key={camp.steps.map((s) => s.id).join()} campaign={camp} /></TabsContent>
          <TabsContent value="settings" className="animate-fade-up"><SettingsTab campaign={camp} /></TabsContent>
        </Tabs>
      )}

      <Dialog open={confirmDel} onOpenChange={setConfirmDel}>
        <DialogContent className="sm:max-w-md" data-testid="delete-campaign-dialog">
          <DialogHeader>
            <DialogTitle>Delete this campaign?</DialogTitle>
            <DialogDescription>All leads, sent-email stats and inbox conversations for this campaign will be removed permanently.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(false)} data-testid="delete-campaign-cancel">Cancel</Button>
            <Button variant="destructive" onClick={() => del.mutate()} disabled={del.isPending} data-testid="delete-campaign-confirm">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
