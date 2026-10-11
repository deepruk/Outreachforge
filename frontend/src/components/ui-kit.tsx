import type { ReactNode } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { LucideIcon } from "lucide-react";
import type { SeriesPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, sub, icon: Icon, accent = "text-cyan", testId, className,
}: { label: string; value: ReactNode; sub?: ReactNode; icon?: LucideIcon; accent?: string; testId: string; className?: string }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-[#1E293B] bg-panel p-4 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-slate-700 motion-reduce:transform-none",
        className,
      )}
      data-testid={testId}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-400">{label}</p>
        {Icon && <Icon className={cn("size-4", accent)} />}
      </div>
      <p className="mt-3 font-mono text-[26px] font-semibold leading-none tracking-tight text-white" data-testid={`${testId}-value`}>{value}</p>
      {sub && <p className="mt-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Pill({ cls, children, testId, dot }: { cls: string; children: ReactNode; testId?: string; dot?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", cls)} data-testid={testId}>
      {dot && <span className={cn("size-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

export function RateBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]">
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action, testId }: { icon: LucideIcon; title: string; body: string; action?: ReactNode; testId: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#263247] bg-panel/50 px-6 py-14 text-center" data-testid={testId}>
      <div className="grid size-12 place-items-center rounded-xl bg-[#1E293B]">
        <Icon className="size-5 text-cyan" />
      </div>
      <h3 className="mt-4 font-heading text-lg font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-400">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const SERIES = [
  { key: "sent", label: "Sent", color: "#2563EB" },
  { key: "opened", label: "Opened", color: "#38BDF8" },
  { key: "clicked", label: "Clicked", color: "#FBBF24" },
  { key: "replied", label: "Replied", color: "#10B981" },
] as const;

export type SeriesKey = (typeof SERIES)[number]["key"];

export function PerformanceChart({ data, visible, height = 280 }: { data: SeriesPoint[]; visible: SeriesKey[]; height?: number }) {
  const fmtDate = (d: string) => new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div style={{ height }} data-testid="performance-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            {SERIES.map((s) => (
              <linearGradient key={s.key} id={`g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#1E293B" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} stroke="#475569" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "#0F172A", border: "1px solid #1E293B", borderRadius: 10, fontSize: 12 }}
            labelStyle={{ color: "#E2E8F0", fontWeight: 600 }}
            labelFormatter={(label: string) => fmtDate(label)}
          />
          {SERIES.filter((s) => visible.includes(s.key)).map((s) => (
            <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} fill={`url(#g-${s.key})`} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SeriesToggles({ visible, onChange }: { visible: SeriesKey[]; onChange: (v: SeriesKey[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {SERIES.map((s) => {
        const on = visible.includes(s.key);
        return (
          <button
            key={s.key}
            type="button"
            data-testid={`chart-toggle-${s.key}`}
            onClick={() => onChange(on ? visible.filter((k) => k !== s.key) : [...visible, s.key])}
            className={cn(
              "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150",
              on ? "border-slate-600 bg-[#1E293B] text-slate-100" : "border-[#1E293B] text-slate-500 hover:text-slate-300",
            )}
          >
            <span className="size-2 rounded-full" style={{ background: on ? s.color : "#334155" }} />
            {s.label}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({ title, action, children, className, testId }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; testId?: string }) {
  return (
    <section className={cn("rounded-xl border border-[#1E293B] bg-panel", className)} data-testid={testId}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-[#1E293B] px-5 py-3.5">
          {title && <h2 className="font-heading text-[15px] font-semibold text-white">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
