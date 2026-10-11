import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, CheckCircle2, Inbox, Layers, MousePointerClick, Repeat, Server, ShieldCheck, Zap,
} from "lucide-react";
import { Logo } from "@/components/AppShell";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Server, title: "Unlimited sender inboxes", body: "Connect any Gmail, Outlook, Zoho or custom domain over SMTP + IMAP. Rotate across inboxes with per-account daily caps." },
  { icon: Layers, title: "Multi-step sequences", body: "Build follow-ups with day delays and {{first_name}} / {{company}} personalization. Follow-ups thread under the first email." },
  { icon: Inbox, title: "Master Inbox", body: "Every reply from every inbox in one place. Label leads Interested, Meeting booked or Not interested and reply inline." },
  { icon: MousePointerClick, title: "Open & click tracking", body: "Invisible pixel and redirect links per message. See unique opens, clicks and replies per step and per campaign." },
  { icon: Repeat, title: "Auto stop on reply", body: "The moment a lead replies, their sequence stops. Bounces from mailer-daemon are detected and the lead is removed." },
  { icon: BarChart3, title: "Analytics that matter", body: "14-day trend lines, step funnels and a campaign leaderboard so you know exactly what copy is working." },
];

const FEED = [
  { who: "olivia@northwind.com", what: "Opened", tone: "text-cyan", when: "2s" },
  { who: "arjun@stackwise.io", what: "Replied · Interested", tone: "text-emerald-300", when: "14s" },
  { who: "liam@peakflow.co", what: "Clicked link", tone: "text-amber-300", when: "41s" },
  { who: "priya@cobalt.ai", what: "Meeting booked", tone: "text-indigo-300", when: "1m" },
  { who: "noah@orbitly.com", what: "Step 2 sent", tone: "text-slate-300", when: "2m" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
            <a href="#features" className="transition-colors hover:text-white" data-testid="landing-nav-features">Features</a>
            <a href="#how" className="transition-colors hover:text-white" data-testid="landing-nav-how">How it works</a>
            <a href="#own" className="transition-colors hover:text-white" data-testid="landing-nav-own">Why own it</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className={buttonVariants({ variant: "ghost", size: "sm" })} data-testid="landing-login-link">Log in</Link>
            <Link to="/signup" className={buttonVariants({ size: "sm" })} data-testid="landing-signup-link">Start free</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -top-40 left-1/3 h-[520px] w-[720px] rounded-full bg-blue-600/20 blur-[120px]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-24 pt-20 lg:grid-cols-12 lg:pt-28">
          <div className="lg:col-span-7 animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200">
              <Zap className="size-3.5" /> Your own cold email engine — no per-seat fees
            </span>
            <h1 className="mt-6 font-heading text-[42px] font-extrabold leading-[1.04] text-white sm:text-[56px]">
              Book more meetings from
              <span className="block bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-300 bg-clip-text text-transparent">your own inboxes.</span>
            </h1>
            <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-slate-400">
              OutreachForge sends personalized multi-step campaigns through the mailboxes you already own, tracks every open and click, and pulls every reply into one Master Inbox.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/signup" className={cn(buttonVariants({ size: "lg" }), "h-11 px-6 text-[15px]")} data-testid="hero-get-started-button">
                Get started <ArrowRight className="size-4" />
              </Link>
              <Link to="/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-6 text-[15px]")} data-testid="hero-demo-button">
                View live demo
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-400">
              {["Real SMTP & IMAP", "Open + click tracking", "Inbox rotation"].map((t) => (
                <span key={t} className="flex items-center gap-2"><CheckCircle2 className="size-4 text-emerald-400" />{t}</span>
              ))}
            </div>
          </div>

          <div className="relative lg:col-span-5">
            <div className="animate-float rounded-2xl border border-white/10 bg-[#111827]/80 p-5 shadow-2xl shadow-blue-950/50 backdrop-blur-xl" data-testid="hero-live-feed">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">Live activity</p>
                <span className="flex items-center gap-1.5 text-xs text-emerald-300"><span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />Sending</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[["Open rate", "48.2%"], ["Click rate", "11.6%"], ["Reply rate", "7.9%"]].map(([l, v]) => (
                  <div key={l} className="rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3">
                    <p className="text-[10px] uppercase tracking-wider text-slate-500">{l}</p>
                    <p className="mt-1 font-mono text-lg font-semibold text-white">{v}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-4 divide-y divide-[#1E293B]">
                {FEED.map((f, i) => (
                  <li key={f.who} className="flex items-center gap-3 py-2.5 animate-fade-up" style={{ animationDelay: `${i * 120}ms` }}>
                    <div className="grid size-7 place-items-center rounded-full bg-[#1E293B] text-[11px] font-bold text-slate-300">{f.who[0].toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-slate-300">{f.who}</p>
                      <p className={cn("text-xs font-medium", f.tone)}>{f.what}</p>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500">{f.when}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-white/10 bg-[#161F30]/90 px-4 py-3 shadow-xl backdrop-blur sm:block">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Inboxes connected</p>
              <p className="font-mono text-xl font-semibold text-white">12 <span className="text-xs text-emerald-300">healthy</span></p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan">Everything you need</p>
            <h2 className="mt-3 font-heading text-[32px] font-bold text-white">The full outbound stack, minus the monthly tax.</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={cn(
                  "group rounded-xl border border-[#1E293B] bg-panel p-6 transition-[transform,border-color] duration-200 hover:-translate-y-1 hover:border-slate-700",
                  i === 0 && "lg:row-span-2 lg:flex lg:flex-col lg:justify-between bg-gradient-to-b from-blue-600/10 to-panel",
                )}
                data-testid={`feature-card-${i}`}
              >
                <div>
                  <div className="grid size-10 place-items-center rounded-lg bg-[#1E293B] text-cyan transition-colors group-hover:bg-blue-600 group-hover:text-white">
                    <f.icon className="size-5" />
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{f.body}</p>
                </div>
                {i === 0 && (
                  <div className="mt-8 hidden space-y-2 lg:block">
                    {["alex@getyourbrand.com", "alex.m@tryyourbrand.com", "sam@yourbrandhq.com"].map((e, j) => (
                      <div key={e} className="flex items-center justify-between rounded-lg border border-[#1E293B] bg-[#0B0F17] px-3 py-2 font-mono text-xs">
                        <span className="text-slate-300">{e}</span>
                        <span className="text-emerald-300">{[38, 27, 19][j]}/50</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how" className="border-t border-white/5 bg-[#090D14] py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-cyan">How it works</p>
            <h2 className="mt-3 font-heading text-[32px] font-bold text-white">Live in four steps.</h2>
            <p className="mt-4 text-slate-400">No DNS gymnastics inside the app — bring the inboxes you've already warmed up and start sending today.</p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-2 lg:col-span-8">
            {[
              ["Connect inboxes", "Add SMTP + IMAP credentials (app passwords) and test the connection in one click."],
              ["Import leads", "Upload a CSV with email, first_name, company — columns are mapped automatically."],
              ["Write the sequence", "Add steps, delays and variables. Preview exactly what each lead will receive."],
              ["Launch & reply", "The engine paces sends across inboxes; replies land in your Master Inbox."],
            ].map(([t, b], i) => (
              <li key={t} className="rounded-xl border border-[#1E293B] bg-panel p-5">
                <span className="font-mono text-sm text-cyan">0{i + 1}</span>
                <h3 className="mt-2 font-heading font-semibold text-white">{t}</h3>
                <p className="mt-1.5 text-sm text-slate-400">{b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="own" className="border-t border-white/5 py-24">
        <div className="mx-auto max-w-7xl px-5">
          <div className="relative overflow-hidden rounded-2xl border border-[#1E293B] bg-gradient-to-br from-[#111827] to-[#0B0F17] p-10 sm:p-14">
            <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-2 lg:items-center">
              <div>
                <ShieldCheck className="size-8 text-emerald-400" />
                <h2 className="mt-4 font-heading text-[32px] font-bold text-white">Your data. Your inboxes. Your platform.</h2>
                <p className="mt-4 max-w-lg text-slate-400">Leads, replies and analytics live in your own database. No shared IP pools, no vendor lock-in, no per-mailbox pricing.</p>
                <Link to="/signup" className={cn(buttonVariants({ size: "lg" }), "mt-8 h-11 px-6")} data-testid="cta-signup-button">
                  Create your workspace <ArrowRight className="size-4" />
                </Link>
              </div>
              <figure className="rounded-xl border border-[#1E293B] bg-[#0B0F17]/70 p-6">
                <blockquote className="text-[15px] leading-relaxed text-slate-300">
                  "We moved 14 inboxes over in an afternoon. Reply handling from one Master Inbox alone saves my SDRs an hour a day."
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <img src="https://images.unsplash.com/photo-1534399315465-2b91232de345?crop=entropy&cs=srgb&fm=jpg&w=120&q=70" alt="" className="size-10 rounded-full object-cover" />
                  <div>
                    <p className="text-sm font-semibold text-white">Arjun Mehta</p>
                    <p className="text-xs text-slate-500">Founder, Scalr B2B</p>
                  </div>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-sm text-slate-500 sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} OutreachForge. Send responsibly — always honor opt-outs.</p>
        </div>
      </footer>
    </div>
  );
}
