import { ApiError } from "@/lib/api";
import type { CampaignStatus, LeadStatus, SenderStatus, ThreadLabel } from "@/lib/types";

export function errMsg(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof ApiError) {
    const b = e.body as { detail?: unknown } | null;
    if (b && typeof b.detail === "string") return b.detail;
    if (b && Array.isArray(b.detail) && b.detail.length) {
      const d = b.detail[0] as { msg?: string; loc?: unknown[] };
      const field = Array.isArray(d.loc) ? String(d.loc[d.loc.length - 1]) : "";
      return `${field ? field + ": " : ""}${d.msg ?? fallback}`;
    }
  }
  return fallback;
}

export const fmt = (n: number) => n.toLocaleString();
export const pctFmt = (n: number) => `${n.toFixed(1)}%`;

export function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
  paused: { label: "Paused", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  draft: { label: "Draft", cls: "bg-slate-500/10 text-slate-300 border-slate-500/30", dot: "bg-slate-400" },
  completed: { label: "Completed", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30", dot: "bg-sky-400" },
};

export const SENDER_STATUS: Record<SenderStatus, { label: string; cls: string }> = {
  active: { label: "Connected", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  error: { label: "Error", cls: "bg-red-500/10 text-red-300 border-red-500/30" },
  paused: { label: "Paused", cls: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
  demo: { label: "Demo · simulated", cls: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30" },
};

export const LEAD_STATUS: Record<LeadStatus, { label: string; cls: string }> = {
  pending: { label: "Not contacted", cls: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
  in_progress: { label: "In sequence", cls: "bg-blue-500/10 text-blue-300 border-blue-500/30" },
  completed: { label: "Completed", cls: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  replied: { label: "Replied", cls: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  bounced: { label: "Bounced", cls: "bg-red-500/10 text-red-300 border-red-500/30" },
  unsubscribed: { label: "Unsubscribed", cls: "bg-orange-500/10 text-orange-300 border-orange-500/30" },
};

export const THREAD_LABEL: Record<ThreadLabel, { label: string; cls: string }> = {
  none: { label: "Unlabeled", cls: "bg-slate-500/10 text-slate-300 border-slate-500/30" },
  interested: { label: "Interested", cls: "bg-[#064E3B] text-[#A7F3D0] border-emerald-700/50" },
  meeting_booked: { label: "Meeting booked", cls: "bg-[#1E1B4B] text-[#C7D2FE] border-indigo-700/50" },
  not_interested: { label: "Not interested", cls: "bg-[#450A0A] text-[#FECACA] border-red-800/50" },
  out_of_office: { label: "Out of office", cls: "bg-[#451A03] text-[#FED7AA] border-orange-800/50" },
  wrong_person: { label: "Wrong person", cls: "bg-slate-700/40 text-slate-200 border-slate-600/50" },
};
