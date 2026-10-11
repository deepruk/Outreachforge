import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";
import { errMsg } from "@/lib/format";
import type { User } from "@/lib/types";
import { Logo } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const navigate = useNavigate();
  const isLogin = mode === "login";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const m = useMutation({
    mutationFn: () =>
      isLogin ? apiPost<User>("/auth/login", { email, password }) : apiPost<User>("/auth/signup", { name, email, password }),
    onSuccess: () => {
      beginSession();
      navigate("/dashboard");
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    m.mutate();
  };
  const fillDemo = () => {
    setEmail("demo@outreachforge.io");
    setPassword("Demo@1234");
  };

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      <div className="relative hidden overflow-hidden border-r border-[#1E293B] bg-[#090D14] p-12 lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 dot-grid opacity-40" />
        <div className="pointer-events-none absolute -left-24 bottom-0 size-[480px] rounded-full bg-blue-600/15 blur-[110px]" />
        <Logo className="relative" />
        <div className="relative mt-auto max-w-md">
          <h2 className="font-heading text-[34px] font-bold leading-tight text-white">
            {isLogin ? "Welcome back. Your pipeline missed you." : "Launch your first campaign in minutes."}
          </h2>
          <p className="mt-4 text-slate-400">
            Sequences, sender rotation, open & click tracking and a unified inbox — running on mailboxes you own.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[["340k+", "emails sent"], ["47%", "avg open rate"], ["8.1%", "avg reply rate"]].map(([v, l]) => (
              <div key={l} className="rounded-xl border border-[#1E293B] bg-panel/80 p-4 backdrop-blur">
                <p className="font-mono text-xl font-semibold text-white">{v}</p>
                <p className="mt-1 text-xs text-slate-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="mt-8 font-heading text-[28px] font-bold text-white lg:mt-0" data-testid="auth-title">
            {isLogin ? "Log in" : "Create your account"}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {isLogin ? "Enter your credentials to access your workspace." : "Free forever on your own infrastructure."}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-4" data-testid="auth-form">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Alex Morgan" className="h-10" data-testid="auth-name-input" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@company.com" className="h-10" data-testid="auth-email-input" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" className="h-10" data-testid="auth-password-input" />
            </div>
            {m.isError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" data-testid="auth-error">
                {errMsg(m.error, "Could not sign in")}
              </p>
            )}
            <Button type="submit" className="h-10 w-full" disabled={m.isPending} data-testid="auth-submit-button">
              {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <>{isLogin ? "Log in" : "Create account"} <ArrowRight className="size-4" /></>}
            </Button>
          </form>
          {isLogin && (
            <button type="button" onClick={fillDemo} className="mt-4 w-full rounded-lg border border-dashed border-[#263247] px-3 py-2.5 text-left text-xs text-slate-400 transition-colors hover:border-cyan-500/40 hover:text-slate-200" data-testid="auth-fill-demo-button">
              <span className="font-semibold text-cyan">Try the demo workspace →</span> demo@outreachforge.io / Demo@1234
            </button>
          )}
          <p className="mt-6 text-center text-sm text-slate-400">
            {isLogin ? "New to OutreachForge? " : "Already have an account? "}
            <Link to={isLogin ? "/signup" : "/login"} className="font-medium text-cyan hover:underline" data-testid="auth-switch-link">
              {isLogin ? "Create an account" : "Log in"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
