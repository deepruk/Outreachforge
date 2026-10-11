import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Inbox, Loader2, Mail, MailOpen, RefreshCw, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { InboxCounts, SyncResult, Thread, ThreadDetail, ThreadLabel, ThreadMessage } from "@/lib/types";
import { THREAD_LABEL, errMsg, timeAgo } from "@/lib/format";
import AppShell from "@/components/AppShell";
import { Pill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const FOLDERS: { key: keyof InboxCounts; label: string; dot?: string }[] = [
  { key: "all", label: "All replies" },
  { key: "unread", label: "Unread", dot: "bg-blue-500" },
  { key: "interested", label: "Interested", dot: "bg-emerald-400" },
  { key: "meeting_booked", label: "Meeting booked", dot: "bg-indigo-400" },
  { key: "not_interested", label: "Not interested", dot: "bg-red-400" },
  { key: "out_of_office", label: "Out of office", dot: "bg-orange-400" },
  { key: "wrong_person", label: "Wrong person", dot: "bg-slate-400" },
];

function Message({ m }: { m: ThreadMessage }) {
  const out = m.direction === "out";
  return (
    <div className={cn("flex", out ? "justify-end" : "justify-start")} data-testid={`thread-message-${m.id}`}>
      <div className={cn("max-w-[88%] rounded-xl border px-4 py-3", out ? "border-blue-500/25 bg-blue-600/10" : "border-[#1E293B] bg-[#161F30]")}>
        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="font-mono text-slate-300">{m.from_email}</span>
          {m.kind === "campaign" && <Pill cls="border-slate-600/50 bg-slate-700/30 text-slate-300">Campaign email</Pill>}
          {m.kind === "manual" && <Pill cls="border-blue-500/30 bg-blue-500/10 text-blue-300">Your reply</Pill>}
          <span>· {new Date(m.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
        </div>
        <p className="mb-1 text-xs font-medium text-slate-400">{m.subject}</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{m.body}</p>
      </div>
    </div>
  );
}

export default function MasterInbox() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const selected = params.get("t");
  const [folder, setFolder] = useState<keyof InboxCounts>("all");
  const [q, setQ] = useState("");
  const [reply, setReply] = useState("");
  const counts = useQuery({ queryKey: ["inbox-counts"], queryFn: () => apiGet<InboxCounts>("/inbox/counts") });
  const threads = useQuery({
    queryKey: ["threads", folder, q],
    queryFn: () => apiGet<Thread[]>(`/inbox/threads?label=${folder}&q=${encodeURIComponent(q)}`),
    refetchInterval: 60000,
  });
  const detail = useQuery({
    queryKey: ["thread", selected],
    queryFn: () => apiGet<ThreadDetail>(`/inbox/threads/${selected}`),
    enabled: !!selected,
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["threads"] });
    qc.invalidateQueries({ queryKey: ["inbox-counts"] });
  };
  const select = (id: string) => {
    setParams({ t: id });
    setReply("");
    setTimeout(invalidate, 400);
  };
  const label = useMutation({
    mutationFn: (l: ThreadLabel) => apiPatch<Thread>(`/inbox/threads/${selected}`, { label: l }),
    onSuccess: () => { invalidate(); qc.invalidateQueries({ queryKey: ["thread", selected] }); toast.success("Label updated"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const markUnread = useMutation({
    mutationFn: () => apiPatch<Thread>(`/inbox/threads/${selected}`, { unread: true }),
    onSuccess: () => { invalidate(); setParams({}); },
  });
  const send = useMutation({
    mutationFn: () => apiPost<ThreadMessage>(`/inbox/threads/${selected}/reply`, { body: reply }),
    onSuccess: () => { setReply(""); qc.invalidateQueries({ queryKey: ["thread", selected] }); invalidate(); toast.success("Reply sent"); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const sync = useMutation({
    mutationFn: () => apiPost<SyncResult>("/inbox/sync"),
    onSuccess: (r) => {
      invalidate();
      if (r.errors.length) toast.error(`Sync issues: ${r.errors[0]}`);
      else toast.success(r.new_replies ? `${r.new_replies} new replies` : "Inbox is up to date");
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = threads.isError ? [] : threads.data ?? [];
  const d = detail.isError ? undefined : detail.data;

  return (
    <AppShell wide>
      <div className="mb-5 flex items-end justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white sm:text-[28px]" data-testid="page-title">Master Inbox</h1>
          <p className="mt-1 text-sm text-slate-400">Every reply from every sender account, in one place.</p>
        </div>
        <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending} data-testid="inbox-sync-button">
          <RefreshCw className={cn("size-4", sync.isPending && "animate-spin")} /> Sync inboxes
        </Button>
      </div>

      <div className="grid h-[calc(100vh-11.5rem)] min-h-[520px] overflow-hidden rounded-xl border border-[#1E293B] bg-panel lg:grid-cols-[220px_360px_1fr] md:grid-cols-[320px_1fr]">
        <aside className="hidden border-r border-[#1E293B] p-3 lg:block" data-testid="inbox-folders">
          {FOLDERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFolder(f.key)}
              data-testid={`inbox-folder-${f.key}`}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
                folder === f.key ? "bg-[#1E293B] text-white" : "text-slate-400 hover:bg-white/[0.03] hover:text-slate-200",
              )}
            >
              {f.dot ? <span className={cn("size-2 rounded-full", f.dot)} /> : <Inbox className="size-3.5" />}
              <span className="flex-1 text-left">{f.label}</span>
              <span className="font-mono text-xs text-slate-500" data-testid={`inbox-folder-count-${f.key}`}>{counts.data?.[f.key] ?? 0}</span>
            </button>
          ))}
        </aside>

        <div className={cn("flex min-h-0 flex-col border-r border-[#1E293B]", selected && "hidden md:flex")}>
          <div className="space-y-2 border-b border-[#1E293B] p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search replies" className="h-9 pl-9" data-testid="inbox-search-input" />
            </div>
            <div className="lg:hidden">
              <Select value={folder} onValueChange={(v: string) => setFolder(v as keyof InboxCounts)}>
                <SelectTrigger size="sm" className="w-full" data-testid="inbox-folder-select"><SelectValue>{(v) => FOLDERS.find((f) => f.key === v)?.label}</SelectValue></SelectTrigger>
                <SelectContent>{FOLDERS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto scroll-thin" data-testid="inbox-thread-list">
            {list.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => select(t.id)}
                  data-testid={`inbox-thread-${t.id}`}
                  className={cn(
                    "relative w-full border-b border-[#1E293B]/70 px-4 py-3 text-left transition-colors duration-150",
                    selected === t.id ? "bg-[#1E293B]/70" : "hover:bg-white/[0.025]",
                  )}
                >
                  {t.unread && <span className="absolute left-1.5 top-[18px] size-1.5 rounded-full bg-blue-500" />}
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn("truncate text-sm", t.unread ? "font-semibold text-white" : "text-slate-200")}>{t.contact_name}</p>
                    <span className="shrink-0 font-mono text-[11px] text-slate-500">{timeAgo(t.last_at)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{t.subject}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{t.snippet}</p>
                  <div className="mt-2 flex items-center gap-2">
                    {t.label !== "none" && <Pill cls={THREAD_LABEL[t.label].cls}>{THREAD_LABEL[t.label].label}</Pill>}
                    <span className="truncate text-[11px] text-slate-600">{t.campaign_name}</span>
                  </div>
                </button>
              </li>
            ))}
            {threads.data && list.length === 0 && (
              <li className="flex flex-col items-center px-6 py-16 text-center text-sm text-slate-500" data-testid="inbox-empty">
                <Inbox className="mb-3 size-6" />No conversations here yet.
              </li>
            )}
          </ul>
        </div>

        <section className={cn("flex min-h-0 flex-col", !selected && "hidden md:flex")} data-testid="inbox-thread-view">
          {!selected || !d ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-slate-500">
              {detail.isLoading ? <Loader2 className="size-5 animate-spin" /> : <><Mail className="mb-3 size-7 text-slate-600" />Select a conversation to read and reply.</>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 border-b border-[#1E293B] px-5 py-3.5">
                <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setParams({})} data-testid="inbox-back-button"><ArrowLeft className="size-4" /></Button>
                <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-sm font-bold text-white">{d.thread.contact_name[0]?.toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white" data-testid="thread-contact-name">{d.thread.contact_name}</p>
                  <p className="flex items-center gap-2 truncate text-xs text-slate-500">
                    <span className="font-mono">{d.thread.contact_email}</span>
                    {d.thread.company && <span className="flex items-center gap-1"><Building2 className="size-3" />{d.thread.company}</span>}
                  </p>
                </div>
                <Select value={d.thread.label} onValueChange={(v: string) => { if (v && v !== d.thread.label) label.mutate(v as ThreadLabel); }}>
                  <SelectTrigger size="sm" className="w-44" data-testid="thread-label-select"><SelectValue>{(v) => THREAD_LABEL[v as ThreadLabel]?.label}</SelectValue></SelectTrigger>
                  <SelectContent>{Object.entries(THREAD_LABEL).map(([k, v]) => <SelectItem key={k} value={k} data-testid={`thread-label-option-${k}`}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon-sm" onClick={() => markUnread.mutate()} title="Mark unread" data-testid="thread-mark-unread-button"><MailOpen className="size-4" /></Button>
              </div>
              <div className="border-b border-[#1E293B] px-5 py-2 text-xs text-slate-500">
                Campaign <span className="text-slate-300">{d.thread.campaign_name}</span> · via <span className="font-mono text-slate-300">{d.thread.sender_email}</span>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5 scroll-thin" data-testid="thread-messages">
                {d.messages.map((m) => <Message key={m.id} m={m} />)}
              </div>
              <form
                onSubmit={(e) => { e.preventDefault(); if (reply.trim()) send.mutate(); }}
                className="border-t border-[#1E293B] p-4"
              >
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && reply.trim()) send.mutate(); }}
                  rows={3}
                  placeholder={`Reply to ${d.thread.contact_name.split(" ")[0]}…`}
                  className="resize-none bg-[#0B0F17]"
                  data-testid="reply-textarea"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-slate-600">Ctrl/⌘ + Enter to send · sends from {d.thread.sender_email}</span>
                  <Button type="submit" size="sm" disabled={!reply.trim() || send.isPending} data-testid="reply-send-button">
                    {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send reply
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </AppShell>
  );
}
