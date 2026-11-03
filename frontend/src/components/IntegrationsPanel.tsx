import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleHelp, Link2, Loader2, PlugZap, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";

type Provider = "apollo" | "neverbounce" | "zerobounce";
type Integration = { id: string; provider: Provider; name: string; category: string; key_hint: string; status: string; created_at: string; last_tested_at: string | null };
const providers: { id: Provider; name: string; category: string; description: string; docs: string }[] = [
  { id: "apollo", name: "Apollo.io", category: "Prospecting", description: "Connect your Apollo account to use your own API access for prospecting workflows.", docs: "https://docs.apollo.io/" },
  { id: "neverbounce", name: "NeverBounce", category: "Email verification", description: "Verify email addresses with your own NeverBounce account.", docs: "https://developers.neverbounce.com/" },
  { id: "zerobounce", name: "ZeroBounce", category: "Email verification", description: "Validate prospect email addresses using your ZeroBounce credits.", docs: "https://www.zerobounce.net/docs/" },
];
const comingSoon = ["ZoomInfo", "Clay", "Lusha", "RocketReach", "Hunter", "Bouncer", "HubSpot", "Salesforce", "Pipedrive", "Slack", "Google Sheets", "Zapier", "Make", "n8n", "Calendly", "Smartlead", "Instantly"];

export default function IntegrationsPanel() {
  const qc = useQueryClient();
  const [keys, setKeys] = useState<Record<string, string>>({});
  const connected = useQuery({ queryKey: ["integrations"], queryFn: () => apiGet<Integration[]>("/integrations") });
  const connect = useMutation({
    mutationFn: (provider: Provider) => apiPost<Integration>("/integrations", { provider, api_key: keys[provider]?.trim() }),
    onSuccess: async (_, provider) => { setKeys((old) => ({ ...old, [provider]: "" })); await qc.invalidateQueries({ queryKey: ["integrations"] }); toast.success("Integration connected"); },
    onError: (e) => toast.error(errMsg(e, "Could not save integration")),
  });
  const test = useMutation({
    mutationFn: (provider: Provider) => apiPost<{ ok: boolean; message: string }>(`/integrations/${provider}/test`),
    onSuccess: async (result) => { await qc.invalidateQueries({ queryKey: ["integrations"] }); result.ok ? toast.success(result.message) : toast.error(result.message); },
    onError: (e) => toast.error(errMsg(e, "Connection test failed")),
  });
  const disconnect = useMutation({
    mutationFn: (provider: Provider) => apiDelete<{ ok: boolean }>(`/integrations/${provider}`),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["integrations"] }); toast.success("Integration disconnected"); },
    onError: (e) => toast.error(errMsg(e, "Could not disconnect integration")),
  });
  const byProvider = new Map((connected.data ?? []).map((item) => [item.provider, item]));
  return (
    <Panel title={<span className="flex items-center gap-2"><PlugZap className="size-4 text-primary" /> Integrations</span>} testId="settings-integrations-panel">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          <div><p className="text-sm font-medium text-foreground">Bring your own API keys</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Each workspace connects its own provider account. Credentials are encrypted before storage and never displayed again. Rohence Flow does not share API credits between customers.</p></div>
        </div>
        {connected.isError && <p role="alert" className="text-sm text-red-300">{errMsg(connected.error, "Could not load integrations")}</p>}
        <div className="grid gap-4">
          {providers.map((provider) => {
            const item = byProvider.get(provider.id);
            return <div key={provider.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-foreground">{provider.name}</h3><span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{provider.category}</span>{item && <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><Check className="size-3.5" /> Connected</span>}</div><p className="mt-1 text-xs text-muted-foreground">{provider.description}</p><a className="mt-2 inline-block text-xs text-primary underline underline-offset-2" href={provider.docs} target="_blank" rel="noreferrer">API documentation</a></div>
                {item && <span className="font-mono text-xs text-muted-foreground">{item.key_hint}</span>}
              </div>
              {item ? <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={test.isPending} onClick={() => test.mutate(provider.id)}><RefreshCw className="size-3.5" /> Test connection</Button><Button size="sm" variant="ghost" disabled={disconnect.isPending} onClick={() => { if (window.confirm(`Disconnect ${provider.name}?`)) disconnect.mutate(provider.id); }}><Unplug className="size-3.5" /> Disconnect</Button></div>
              : <div className="mt-4 space-y-2"><Label htmlFor={`integration-${provider.id}`}>API key</Label><div className="flex flex-col gap-2 sm:flex-row"><Input id={`integration-${provider.id}`} type="password" autoComplete="off" value={keys[provider.id] ?? ""} onChange={(e) => setKeys((old) => ({ ...old, [provider.id]: e.target.value }))} placeholder={`Paste your ${provider.name} API key`} /><Button size="sm" disabled={connect.isPending || !(keys[provider.id] ?? "").trim()} onClick={() => connect.mutate(provider.id)}><Link2 className="size-3.5" /> Connect</Button></div></div>}
            </div>;
          })}
        </div>
        <div><h3 className="mb-2 text-sm font-medium text-foreground">More integrations planned</h3><div className="flex flex-wrap gap-2">{comingSoon.map((name) => <span key={name} className="rounded-md border border-border bg-background/40 px-2.5 py-1 text-xs text-muted-foreground">{name}</span>)}</div><p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CircleHelp className="size-3.5" /> These are planned integrations, not active connections yet.</p></div>
      </div>
    </Panel>
  );
}
