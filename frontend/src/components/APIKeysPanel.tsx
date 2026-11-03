import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";

type APIKey = {
  id: string; name: string; prefix: string; scopes: string[];
  created_at: string; last_used_at: string | null; revoked_at: string | null;
};
type CreatedKey = APIKey & { api_key: string; warning: string };

export default function APIKeysPanel() {
  const qc = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const keys = useQuery({ queryKey: ["api-keys"], queryFn: () => apiGet<APIKey[]>("/auth/api-keys") });
  const create = useMutation({
    mutationFn: () => apiPost<CreatedKey>("/auth/api-keys", { name: keyName.trim() }),
    onSuccess: async (data) => {
      setNewSecret(data.api_key);
      setKeyName("");
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key created. Copy it now — it won't be shown again.");
    },
    onError: (error) => toast.error(errMsg(error, "Could not create API key")),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => apiDelete<{ ok: boolean }>(`/auth/api-keys/${id}`),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["api-keys"] });
      toast.success("API key revoked");
    },
    onError: (error) => toast.error(errMsg(error, "Could not revoke API key")),
  });

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success("Copied to clipboard"); }
    catch { toast.error("Clipboard access failed. Select and copy the key manually."); }
  };
  const activeKeys = (keys.data ?? []).filter((key) => !key.revoked_at);
  return (
    <Panel title={<span className="flex items-center gap-2"><KeyRound className="size-4 text-primary" /> API keys</span>} testId="settings-api-keys-panel">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-foreground">Secure access to Rohence Flow</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Create keys for your integrations and AI agents. Keys can read campaigns and create or update drafts, but cannot launch campaigns or send emails. The full secret is displayed only once.</p>
          </div>
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (keyName.trim()) create.mutate(); }} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="api-key-name">Key name</Label>
            <Input id="api-key-name" value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="e.g. Claude Agent" maxLength={80} required data-testid="api-key-name" />
          </div>
          <Button type="submit" disabled={create.isPending || !keyName.trim()} data-testid="api-key-create">
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <><Plus className="size-4" /> Create API key</>}
          </Button>
        </form>
        {newSecret && (
          <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4" data-testid="api-key-created-secret">
            <p className="text-sm font-semibold text-foreground">Copy your new API key now</p>
            <p className="text-xs text-muted-foreground">For security, Rohence Flow won't show this secret again after you leave this page.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input readOnly value={newSecret} className="font-mono text-xs" aria-label="New API key secret" />
              <Button type="button" variant="outline" onClick={() => copy(newSecret)}><Copy className="size-4" /> Copy key</Button>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setNewSecret(null)}>I've saved it</Button>
          </div>
        )}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Your keys</h3>
            <span className="text-xs text-muted-foreground">{activeKeys.length} active</span>
          </div>
          {keys.isLoading ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading API keys…</div>
          : keys.isError ? <p role="alert" className="text-sm text-red-300">{errMsg(keys.error, "Could not load API keys")}</p>
          : activeKeys.length === 0 ? <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No API keys yet. Create one above to connect an integration.</p>
          : <div className="divide-y divide-border rounded-lg border border-border">
            {activeKeys.map((key) => (
              <div key={key.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{key.name}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{key.prefix}••••••••</p>
                  <p className="mt-1 text-xs text-muted-foreground">Created {new Date(key.created_at).toLocaleDateString()} · {key.last_used_at ? `Last used ${new Date(key.last_used_at).toLocaleDateString()}` : "Not used yet"}</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="text-red-300 hover:text-red-200" disabled={revoke.isPending} onClick={() => { if (window.confirm(`Revoke API key "${key.name}"? Any integration using it will stop working.`)) revoke.mutate(key.id); }} data-testid={`api-key-revoke-${key.id}`}>
                  <Trash2 className="size-4" /> Revoke
                </Button>
              </div>
            ))}
          </div>}
        </div>
        <p className="text-xs text-muted-foreground">API base URL: <code className="rounded bg-secondary px-1.5 py-0.5">https://outreachforge.onrender.com/api/v1</code> · <a className="text-primary underline underline-offset-2" href="https://outreachforge.onrender.com/api/docs" target="_blank" rel="noreferrer">View API documentation</a></p>
      </div>
    </Panel>
  );
}
