import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Link2, PlugZap, RefreshCw, Search, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";

type Provider = "apollo" | "neverbounce" | "zerobounce";
type Integration = { id: string; provider: Provider; name: string; category: string; key_hint: string; status: string; created_at: string; last_tested_at: string | null };
type Connector = { id: string; name: string; category: string; description: string; docs?: string; provider?: Provider; comingSoon?: boolean };
const connectors: Connector[] = [
  { id: "apollo", provider: "apollo", name: "Apollo", category: "Prospecting", description: "Prospect discovery and enrichment", docs: "https://docs.apollo.io/" },
  { id: "neverbounce", provider: "neverbounce", name: "NeverBounce", category: "Email verification", description: "Verify email addresses before outreach", docs: "https://developers.neverbounce.com/" },
  { id: "zerobounce", provider: "zerobounce", name: "ZeroBounce", category: "Email verification", description: "Validate email addresses and protect deliverability", docs: "https://www.zerobounce.net/docs/" },
  { id: "airtable", name: "Airtable", category: "Database", description: "Sync and manage database records", comingSoon: true },
  { id: "anymail", name: "Anymail Finder", category: "Email finder", description: "Discover and verify professional email addresses", comingSoon: true },
  { id: "aimfox", name: "Aimfox", category: "LinkedIn automation", description: "LinkedIn automation and outreach", comingSoon: true },
  { id: "attio", name: "Attio", category: "CRM", description: "Relationship management and automation", comingSoon: true },
  { id: "cal", name: "Cal.com", category: "Scheduling", description: "Meeting booking and calendar management", comingSoon: true },
  { id: "calendly", name: "Calendly", category: "Scheduling", description: "Scheduling automation", comingSoon: true },
  { id: "close", name: "Close", category: "CRM", description: "CRM and sales workflow automation", comingSoon: true },
  { id: "clay", name: "Clay", category: "Enrichment", description: "Enrich and automate prospect research", comingSoon: true },
  { id: "hubspot", name: "HubSpot", category: "CRM", description: "Sync contacts, companies, and deals", comingSoon: true },
  { id: "salesforce", name: "Salesforce", category: "CRM", description: "Connect your sales CRM", comingSoon: true },
  { id: "pipedrive", name: "Pipedrive", category: "CRM", description: "Sync leads and sales activities", comingSoon: true },
  { id: "slack", name: "Slack", category: "Communication", description: "Get outreach notifications", comingSoon: true },
  { id: "sheets", name: "Google Sheets", category: "Database", description: "Send prospect data to spreadsheets", comingSoon: true },
  { id: "zapier", name: "Zapier", category: "Automation", description: "Connect workflows across your tools", comingSoon: true },
  { id: "make", name: "Make", category: "Automation", description: "Build visual workflow automations", comingSoon: true },
  { id: "n8n", name: "n8n", category: "Automation", description: "Connect custom workflow automations", comingSoon: true },
  { id: "smartlead", name: "Smartlead", category: "Outreach", description: "Connect your outbound email workflows", comingSoon: true },
  { id: "instantly", name: "Instantly", category: "Outreach", description: "Connect outbound campaign workflows", comingSoon: true },
  { id: "hunter", name: "Hunter", category: "Email finder", description: "Find professional email addresses", comingSoon: true },
  { id: "lusha", name: "Lusha", category: "Prospecting", description: "Discover business contact information", comingSoon: true },
  { id: "rocketreach", name: "RocketReach", category: "Prospecting", description: "Find professional contact details", comingSoon: true },
  { id: "zoominfo", name: "ZoomInfo", category: "Prospecting", description: "B2B company and contact intelligence", comingSoon: true },
];

export default function IntegrationsPanel() {
  const qc = useQueryClient();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "configured" | "not-configured">("all");
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const connected = useQuery({ queryKey: ["integrations"], queryFn: () => apiGet<Integration[]>("/integrations") });
  const connect = useMutation({
    mutationFn: (provider: Provider) => apiPost<Integration>("/integrations", { provider, api_key: keys[provider]?.trim() }),
    onSuccess: async (_, provider) => { setKeys((old) => ({ ...old, [provider]: "" })); setSelectedProvider(null); await qc.invalidateQueries({ queryKey: ["integrations"] }); toast.success("Connector connected"); },
    onError: (e) => toast.error(errMsg(e, "Could not connect this tool")),
  });
  const test = useMutation({
    mutationFn: (provider: Provider) => apiPost<{ ok: boolean; message: string }>(`/integrations/${provider}/test`),
    onSuccess: async (result) => { await qc.invalidateQueries({ queryKey: ["integrations"] }); result.ok ? toast.success(result.message) : toast.error(result.message); },
    onError: (e) => toast.error(errMsg(e, "Connection test failed")),
  });
  const disconnect = useMutation({
    mutationFn: (provider: Provider) => apiDelete<{ ok: boolean }>(`/integrations/${provider}`),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["integrations"] }); toast.success("Connector disconnected"); },
    onError: (e) => toast.error(errMsg(e, "Could not disconnect this tool")),
  });
  const byProvider = new Map((connected.data ?? []).map((item) => [item.provider, item]));
  const configuredCount = connectors.filter((c) => c.provider && byProvider.has(c.provider)).length;
  const filtered = useMemo(() => connectors.filter((c) => {
    const isConfigured = !!c.provider && byProvider.has(c.provider);
    const matchesFilter = filter === "all" || (filter === "configured" ? isConfigured : !isConfigured);
    const q = search.trim().toLowerCase();
    return matchesFilter && (!q || [c.name, c.category, c.description].some((v) => v.toLowerCase().includes(q)));
  }), [filter, search, connected.data]);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-6 border-b border-border lg:border-0">
          {([["all", "All"], ["configured", "Configured"], ["not-configured", "Not Configured"]] as const).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${filter === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}{id === "all" ? ` (${connectors.length})` : id === "configured" ? ` (${configuredCount})` : ` (${connectors.length - configuredCount})`}
            </button>
          ))}
        </div>
        <div className="relative w-full lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" name="connector-search" autoComplete="off" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by tool name..." className="pl-9" />
        </div>
      </div>
      {connected.isError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errMsg(connected.error, "Could not load connectors")}</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filtered.map((connector) => {
          const item = connector.provider ? byProvider.get(connector.provider) : undefined;
          return (
            <article key={connector.id} className="flex min-h-[245px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex-1 p-4">
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-border bg-background text-primary"><PlugZap className="size-5" /></div>
                <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-foreground">{connector.name}</h2><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{connector.category}</span></div>
                <p className="mt-2 min-h-10 text-sm leading-relaxed text-muted-foreground">{connector.description}</p>
                <div className="mt-3">
                  {connector.comingSoon ? <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-[10px] font-medium uppercase text-muted-foreground"><Clock3 className="size-3" /> Coming soon</span>
                    : item ? <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium uppercase text-emerald-500"><Check className="size-3" /> Connected</span>
                    : <span className="rounded-md border border-amber-500/50 bg-amber-500/10 px-2 py-1 text-[10px] font-medium uppercase text-amber-600">Not connected</span>}
                </div>
                {connector.docs && <a href={connector.docs} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs text-primary hover:underline">API documentation</a>}
                {item && <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground">{item.key_hint}</p>}
              </div>
              <div className="flex min-h-14 items-center justify-end gap-2 border-t border-border bg-secondary/30 px-4 py-2">
                {connector.comingSoon ? <Button size="sm" variant="outline" disabled><Clock3 className="size-3.5" /> Coming soon</Button>
                  : item ? <><Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate(connector.provider!)}><RefreshCw className="size-3.5" /> Test</Button><Button size="sm" variant="ghost" disabled={disconnect.isPending} onClick={() => { if (window.confirm(`Disconnect ${connector.name}?`)) disconnect.mutate(connector.provider!); }}><Unplug className="size-3.5" /> Disconnect</Button></>
                  : <Button size="sm" onClick={() => setSelectedProvider(connector.provider!)}><Link2 className="size-3.5" /> Connect</Button>}
              </div>
            </article>
          );
        })}
      </div>
      {filtered.length === 0 && <div className="rounded-xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">No connectors match your search.</div>}

      <Dialog open={!!selectedProvider} onOpenChange={(open) => { if (!open) setSelectedProvider(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-xl border border-border bg-secondary text-primary"><PlugZap className="size-6" /></div>
            <DialogTitle className="text-center text-lg">Connect your {connectors.find((c) => c.provider === selectedProvider)?.name} account</DialogTitle>
            <DialogDescription className="text-center">Enter your API key to securely connect this tool to Rohence Flow. Your key will be encrypted before it is stored.</DialogDescription>
          </DialogHeader>
          {selectedProvider && <form onSubmit={(e) => { e.preventDefault(); if ((keys[selectedProvider] ?? "").trim()) connect.mutate(selectedProvider); }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="connector-api-key">{connectors.find((c) => c.provider === selectedProvider)?.name} API Key</Label>
              <Input id="connector-api-key" name="connector-api-key" type="password" autoComplete="new-password" autoFocus value={keys[selectedProvider] ?? ""} onChange={(e) => setKeys((old) => ({ ...old, [selectedProvider]: e.target.value }))} placeholder="Enter your API key" required />
              <p className="text-xs text-muted-foreground">You can find this key in your provider account's developer or API settings.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedProvider(null)}>Cancel</Button>
              <Button type="submit" disabled={connect.isPending || !(keys[selectedProvider] ?? "").trim()}>{connect.isPending ? "Connecting..." : "Connect"}</Button>
            </DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>
      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/20 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" />
        <div><p className="text-sm font-medium text-foreground">Your accounts, your API keys</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Connected credentials are encrypted before storage. Each workspace uses its own provider account and credits. Rohence Flow never displays your full API keys again.</p></div>
      </div>
    </div>
  );
}
