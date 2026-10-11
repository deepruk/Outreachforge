import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Campaign, CampaignStatus } from "@/lib/types";
import { CAMPAIGN_STATUS, errMsg, fmt, pctFmt, timeAgo } from "@/lib/format";
import AppShell, { PageHeader } from "@/components/AppShell";
import { EmptyState, Pill, RateBar } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const FILTERS: ("all" | CampaignStatus)[] = ["all", "active", "paused", "draft", "completed"];

export default function Campaigns() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [name, setName] = useState("");
  const open = params.get("new") === "1";
  const setOpen = (v: boolean) => setParams(v ? { new: "1" } : {});
  const camps = useQuery({ queryKey: ["campaigns"], queryFn: () => apiGet<Campaign[]>("/campaigns") });
  const create = useMutation({
    mutationFn: () => apiPost<Campaign>("/campaigns", { name }),
    onSuccess: (c) => {
      qc.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign created");
      setName("");
      navigate(`/campaigns/${c.id}?tab=leads`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = useMemo(
    () =>
      (camps.isError ? [] : camps.data ?? []).filter(
        (c) => (filter === "all" || c.status === filter) && c.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [camps.data, camps.isError, filter, q],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) create.mutate();
  };

  return (
    <AppShell>
      <PageHeader
        title="Campaigns"
        subtitle="Sequences, leads and sending schedules."
        actions={<Button onClick={() => setOpen(true)} data-testid="create-campaign-button"><Plus className="size-4" /> New campaign</Button>}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-panel p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              data-testid={`campaign-filter-${f}`}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors duration-150",
                filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground/90",
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search campaigns" className="h-9 pl-9" data-testid="campaign-search-input" />
        </div>
      </div>

      {camps.data && list.length === 0 ? (
        <EmptyState
          icon={Mail}
          testId="campaigns-empty"
          title={camps.data.length ? "No campaigns match" : "Create your first campaign"}
          body="A campaign is a list of leads plus a sequence of emails sent from your connected inboxes."
          action={<Button onClick={() => setOpen(true)} data-testid="empty-create-campaign-button"><Plus className="size-4" />New campaign</Button>}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-panel" data-testid="campaigns-table">
          <div className="hidden grid-cols-12 gap-3 border-b border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground md:grid">
            <span className="col-span-4">Campaign</span>
            <span className="col-span-2">Progress</span>
            <span className="col-span-1 text-right">Leads</span>
            <span className="col-span-1 text-right">Sent</span>
            <span className="col-span-1 text-right">Opened</span>
            <span className="col-span-1 text-right">Clicked</span>
            <span className="col-span-2 text-right">Replied</span>
          </div>
          {!camps.data && !camps.isError &&
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="m-3 h-12 animate-pulse rounded-lg bg-muted" />)}
          {list.map((c, i) => (
            <Link
              key={c.id}
              to={`/campaigns/${c.id}`}
              className="grid grid-cols-2 items-center gap-3 border-b border-border px-5 py-4 transition-colors duration-150 last:border-0 hover:bg-foreground/[0.025] md:grid-cols-12 animate-fade-up"
              style={{ animationDelay: `${i * 40}ms` }}
              data-testid={`campaign-row-${c.id}`}
            >
              <div className="col-span-2 min-w-0 md:col-span-4">
                <p className="truncate font-medium text-foreground">{c.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Pill cls={CAMPAIGN_STATUS[c.status].cls} dot={CAMPAIGN_STATUS[c.status].dot} testId={`campaign-status-${c.id}`}>{CAMPAIGN_STATUS[c.status].label}</Pill>
                  <span className="text-xs text-muted-foreground">{c.steps.length} steps · created {timeAgo(c.created_at)}</span>
                </div>
              </div>
              <div className="col-span-2 md:col-span-2">
                <p className="mb-1 font-mono text-[11px] text-muted-foreground">{c.progress.toFixed(0)}%</p>
                <RateBar value={c.progress} />
              </div>
              <Metric className="md:col-span-1" label="Leads" v={fmt(c.stats.leads)} />
              <Metric className="md:col-span-1" label="Sent" v={fmt(c.stats.sent)} />
              <Metric className="md:col-span-1" label="Opened" v={fmt(c.stats.opened)} sub={pctFmt(c.stats.open_rate)} />
              <Metric className="md:col-span-1" label="Clicked" v={fmt(c.stats.clicked)} sub={pctFmt(c.stats.click_rate)} />
              <Metric className="md:col-span-2" label="Replied" v={fmt(c.stats.replied)} sub={pctFmt(c.stats.reply_rate)} tone="text-emerald-300" />
            </Link>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-testid="create-campaign-dialog">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>New campaign</DialogTitle>
              <DialogDescription>We'll start you with a proven 2-step sequence you can edit.</DialogDescription>
            </DialogHeader>
            <div className="my-5 space-y-1.5">
              <Label htmlFor="cname">Campaign name</Label>
              <Input id="cname" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q4 Fintech Founders" data-testid="campaign-name-input" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} data-testid="create-campaign-cancel">Cancel</Button>
              <Button type="submit" disabled={!name.trim() || create.isPending} data-testid="create-campaign-submit">
                {create.isPending && <Loader2 className="size-4 animate-spin" />} Create campaign
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Metric({ label, v, sub, tone, className }: { label: string; v: string; sub?: string; tone?: string; className?: string }) {
  return (
    <div className={cn("text-left font-mono text-sm md:text-right", className)}>
      <span className="block text-[10px] uppercase text-muted-foreground md:hidden">{label}</span>
      <span className={cn("text-foreground", tone)}>{v}</span>
      {sub && <span className="ml-1.5 text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}
