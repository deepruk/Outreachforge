import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import { apiGet } from "@/lib/api";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";

type BounceEvent = {
  id: string;
  from_email: string;
  to_email: string;
  sender_email: string;
  subject: string;
  body: string;
  at: string;
  matched_recipients: string[];
  campaign_names: string[];
  status: "matched" | "needs_review" | string;
};
type BounceResponse = { items: BounceEvent[]; count: number };

export default function Bounces() {
  const query = useQuery({
    queryKey: ["bounces"],
    queryFn: () => apiGet<BounceResponse>("/inbox/bounces"),
    refetchInterval: 60000,
  });
  const items = query.data?.items ?? [];
  return (
    <AppShell wide>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bounce log</h1>
          <p className="mt-1 text-sm text-muted-foreground">Original delivery-failure notices retained for review, including notices that could not be confidently matched to a lead.</p>
        </div>
        <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
          <RefreshCw className={`mr-2 size-4 ${query.isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-panel p-4">
          <p className="text-sm text-muted-foreground">Bounce notices captured</p>
          <p className="mt-1 text-2xl font-semibold">{query.data?.count ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-border bg-panel p-4">
          <p className="text-sm text-muted-foreground">Needs review</p>
          <p className="mt-1 text-2xl font-semibold">{items.filter((x) => x.status !== "matched").length}</p>
        </div>
      </div>
      {query.isError && <div className="rounded-lg border border-red-500/30 p-4 text-sm text-red-300">Could not load bounce notices. Try refreshing.</div>}
      {!query.isLoading && !query.isError && items.length === 0 && (
        <div className="rounded-xl border border-border bg-panel p-8 text-center">
          <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
          <p className="font-medium">No bounce notices captured yet</p>
          <p className="mt-1 text-sm text-muted-foreground">New delivery-failure messages detected during inbox sync will appear here. Previously skipped bounce emails cannot be recovered by this change.</p>
        </div>
      )}
      <div className="space-y-3">
        {items.map((item) => (
          <details key={item.id} className="rounded-xl border border-border bg-panel p-4">
            <summary className="cursor-pointer list-none">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{item.subject || "(no subject)"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.from_email} · {item.sender_email || item.to_email} · {new Date(item.at).toLocaleString()}</p>
                  <p className="mt-2 text-sm">Recipients found: {item.matched_recipients?.length ? item.matched_recipients.join(", ") : "No confident match"}</p>
                  {item.campaign_names?.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Campaign: {item.campaign_names.join(", ")}</p>}
                </div>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${item.status === "matched" ? "border-emerald-500/30 text-emerald-300" : "border-amber-500/30 text-amber-300"}`}>
                  <AlertTriangle className="size-3" /> {item.status === "matched" ? "Matched" : "Needs review"}
                </span>
              </div>
            </summary>
            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Original bounce notice</p>
              <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-xs leading-relaxed">{item.body || "(The mail provider supplied no readable body.)"}</pre>
            </div>
          </details>
        ))}
      </div>
    </AppShell>
  );
}
