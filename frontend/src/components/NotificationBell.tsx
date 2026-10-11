import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellRing, CalendarCheck, Flame } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Notification, NotificationList } from "@/lib/types";
import { errMsg, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const LABEL = { interested: "Interested", meeting_booked: "Meeting booked" } as Record<string, string>;
const canDesktop = () => typeof window !== "undefined" && "Notification" in window;

export default function NotificationBell() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<string>(canDesktop() ? window.Notification.permission : "unsupported");
  const seen = useRef<Set<string> | null>(null);
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationList>("/notifications"),
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const openThread = (n: Notification) => {
    void apiPost(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
    setOpen(false);
    navigate(`/inbox?t=${n.thread_id}`);
  };

  // Alert only for notifications that arrive after this page loaded.
  useEffect(() => {
    const items = q.data?.items;
    if (!items) return;
    if (seen.current === null) {
      seen.current = new Set(items.map((n) => n.id));
      return;
    }
    const fresh = items.filter((n) => !seen.current!.has(n.id) && !n.read);
    fresh.forEach((n) => seen.current!.add(n.id));
    if (!fresh.length) return;
    qc.invalidateQueries({ queryKey: ["threads"] });
    qc.invalidateQueries({ queryKey: ["inbox-counts"] });
    for (const n of fresh.slice(0, 3)) {
      const title = `${n.label === "meeting_booked" ? "📅 Meeting booked" : "🔥 Hot lead"}: ${n.contact_name}${n.company ? ` · ${n.company}` : ""}`;
      toast.success(title, {
        description: n.snippet,
        duration: 12000,
        action: { label: "Reply now", onClick: () => openThread(n) },
      });
      if (perm === "granted" && document.visibilityState !== "visible") {
        const dn = new window.Notification(title, { body: n.snippet, tag: n.id });
        dn.onclick = () => { window.focus(); openThread(n); };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const readAll = useMutation({
    mutationFn: () => apiPost("/notifications/read-all"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const test = useMutation({
    mutationFn: () => apiPost<Notification>("/notifications/test"),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const enableDesktop = async () => {
    if (!canDesktop()) return;
    const p = await window.Notification.requestPermission();
    setPerm(p);
    if (p === "granted") toast.success("Desktop alerts enabled");
    else toast.error("Desktop alerts were blocked in your browser settings");
  };
  const unread = q.isError ? 0 : q.data?.unread ?? 0;
  const items = q.isError ? [] : q.data?.items ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="icon-sm" className="relative" aria-label="Hot lead alerts" data-testid="notifications-bell" />}>
        {unread > 0 ? <BellRing className="size-4 text-amber-300" /> : <Bell className="size-4" />}
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 font-mono text-[10px] font-bold text-white" data-testid="notifications-unread-count">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 border border-[#1E293B] bg-[#111827] p-0 shadow-2xl shadow-black/50" data-testid="notifications-panel">
        <div className="flex items-center justify-between border-b border-[#1E293B] px-4 py-3">
          <div>
            <p className="font-heading text-sm font-semibold text-white">Hot lead alerts</p>
            <p className="text-[11px] text-slate-500">Interested & meeting-booked replies</p>
          </div>
          {unread > 0 && (
            <button type="button" onClick={() => readAll.mutate()} className="text-xs text-cyan hover:underline" data-testid="notifications-read-all">Mark all read</button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto scroll-thin">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => openThread(n)} className={cn("flex w-full gap-3 border-b border-[#1E293B]/60 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]", !n.read && "bg-blue-600/[0.06]")} data-testid={`notification-item-${n.id}`}>
                <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-full", n.label === "meeting_booked" ? "bg-indigo-500/20 text-indigo-300" : "bg-emerald-500/20 text-emerald-300")}>
                  {n.label === "meeting_booked" ? <CalendarCheck className="size-3.5" /> : <Flame className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn("truncate text-sm", n.read ? "text-slate-300" : "font-semibold text-white")}>{n.contact_name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-slate-500">{timeAgo(n.created_at)}</span>
                  </span>
                  <span className="block text-[11px] text-slate-500">{LABEL[n.label] ?? n.label}{n.campaign_name ? ` · ${n.campaign_name}` : ""}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">{n.snippet}</span>
                </span>
              </button>
            </li>
          ))}
          {items.length === 0 && <li className="px-4 py-10 text-center text-sm text-slate-500">No hot replies yet.</li>}
        </ul>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          {perm === "granted" ? (
            <span className="text-[11px] text-emerald-300" data-testid="notifications-desktop-on">Desktop alerts on</span>
          ) : perm === "unsupported" ? <span /> : (
            <button type="button" onClick={enableDesktop} className="text-xs text-cyan hover:underline" data-testid="notifications-enable-desktop">Enable desktop alerts</button>
          )}
          <button type="button" onClick={() => test.mutate()} className="text-xs text-slate-400 hover:text-slate-200" data-testid="notifications-send-test">Send test alert</button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
