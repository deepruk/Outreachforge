import { useState } from "react";
import { ArrowRight, Check, Globe, Loader2, Mail, RefreshCw, Sparkles, Target, Wand2 } from "lucide-react";
import { toast } from "sonner";
import AppShell, { PageHeader } from "@/components/AppShell";
import { apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RewriteGoal, RewriteLength, RewriteTone, RewriteResponse } from "@/lib/types";

type BusinessProfile = {
  website: string;
  company_summary: string;
  services: string[];
  ideal_customers: string[];
  value_propositions: string[];
  proof_points: string[];
};

const fields: { key: keyof Omit<BusinessProfile, "website">; label: string; hint: string }[] = [
  { key: "company_summary", label: "Company summary", hint: "Describe what the company does." },
  { key: "services", label: "Services", hint: "One service per line." },
  { key: "ideal_customers", label: "Ideal customers", hint: "One audience per line." },
  { key: "value_propositions", label: "Value propositions", hint: "One benefit per line." },
  { key: "proof_points", label: "Proof points", hint: "Only verifiable results or claims." },
];

export default function AIWriter() {
  const [website, setWebsite] = useState("https://rohence.com");
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [audience, setAudience] = useState("Marketing agencies");
  const [service, setService] = useState("__best_fit__");
  const [manualService, setManualService] = useState("");
  const [tone, setTone] = useState<RewriteTone>("professional");
  const [goal, setGoal] = useState<RewriteGoal>("cold_intro");
  const [length, setLength] = useState<RewriteLength>("short");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [preheader, setPreheader] = useState("");
  const [draft, setDraft] = useState<RewriteResponse | null>(null);
  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);

  const readWebsite = async () => {
    setResearching(true);
    setDraft(null);
    try {
      const result = await apiPost<BusinessProfile>("/ai/website-profile", { website: website.trim() });
      setProfile(result);
      setService("__best_fit__");
      toast.success("Website profile ready. Review the facts before generating.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setResearching(false);
    }
  };

  const updateProfile = (key: keyof Omit<BusinessProfile, "website">, value: string) => {
    if (!profile) return;
    setProfile({ ...profile, [key]: key === "company_summary" ? value : value.split("\n").map((v) => v.trim()).filter(Boolean) } as BusinessProfile);
  };

  const generate = async () => {
    setGenerating(true);
    try {
      const result = await apiPost<RewriteResponse>("/ai/rewrite-step", {
        step: { subject, subject_b: "", body, preheader },
        tone, goal, length,
        audience: audience.trim(),
        product: service !== "__best_fit__" ? service : manualService.trim(),
        selected_service: service === "__best_fit__" ? "__best_fit__" : service,
        business_profile: profile || undefined,
      });
      setDraft(result);
      toast.success("Email draft generated");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGenerating(false);
    }
  };

  const applyDraft = () => {
    if (!draft) return;
    setSubject(draft.subject);
    setBody(draft.body);
    setPreheader(draft.preheader);
    setDraft(null);
    toast.success("Draft moved into the editor");
  };

  return (
    <AppShell wide>
      <PageHeader
        eyebrow="AI WORKSPACE"
        title="AI Email Writer"
        subtitle="Teach Gemini about your business, choose a service, and create a relevant outreach email for your audience."
        actions={<Button variant="outline" onClick={() => { setProfile(null); setDraft(null); }}><RefreshCw className="size-4" /> Start over</Button>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Globe className="size-5" /></span>
              <div><h2 className="font-semibold">1. Understand your business</h2><p className="mt-1 text-sm text-muted-foreground">We'll read up to six public pages from your website and extract services and business facts.</p></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yourcompany.com" data-testid="ai-writer-website" />
              <Button onClick={readWebsite} disabled={researching || !website.trim()} className="shrink-0" data-testid="ai-writer-read-website">{researching ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />} Read website</Button>
            </div>
            {profile && <div className="space-y-4 border-t border-border pt-4" data-testid="ai-writer-profile">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-500"><Check className="size-4" /> Website scanned — review the extracted facts</div>
              {fields.map(({ key, label, hint }) => <div className="space-y-1.5" key={key}>
                <Label>{label}</Label>
                <Textarea rows={key === "company_summary" ? 2 : 3} value={key === "company_summary" ? profile.company_summary : (profile[key] as string[]).join("\n")} onChange={(e) => updateProfile(key, e.target.value)} placeholder={hint} data-testid={`ai-writer-profile-${key}`} />
              </div>)}
            </div>}
          </section>

          <section className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Target className="size-5" /></span><div><h2 className="font-semibold">2. Choose your offer and audience</h2><p className="mt-1 text-sm text-muted-foreground">The AI can recommend a service based on what you sell and who you're contacting.</p></div></div>
            <div className="space-y-1.5"><Label>Service to promote</Label>
              {profile?.services?.length ? <Select value={service} onValueChange={setService}><SelectTrigger data-testid="ai-writer-service"><SelectValue placeholder="Choose service" /></SelectTrigger><SelectContent><SelectItem value="__best_fit__">Recommend best fit for my audience</SelectItem>{profile.services.map((v, i) => <SelectItem key={`${i}-${v}`} value={v}>{v}</SelectItem>)}</SelectContent></Select> : <Input value={manualService} onChange={(e) => setManualService(e.target.value)} placeholder="Optional service (or read website first)" />}
              <p className="text-xs text-muted-foreground">Only services in your reviewed profile should be used for recommendations.</p>
            </div>
            <div className="space-y-1.5"><Label>Target audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. marketing agencies" data-testid="ai-writer-audience" /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5"><Label>Tone</Label><Select value={tone} onValueChange={(v) => setTone(v as RewriteTone)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="professional">Professional</SelectItem><SelectItem value="casual">Casual</SelectItem><SelectItem value="friendly">Friendly</SelectItem><SelectItem value="direct">Direct</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Email type</Label><Select value={goal} onValueChange={(v) => setGoal(v as RewriteGoal)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cold_intro">Cold intro</SelectItem><SelectItem value="followup">Follow-up</SelectItem><SelectItem value="breakup">Break-up</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label>Length</Label><Select value={length} onValueChange={(v) => setLength(v as RewriteLength)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="short">Short</SelectItem><SelectItem value="medium">Medium</SelectItem></SelectContent></Select></div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-panel p-5 space-y-4">
            <div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Mail className="size-5" /></span><div><h2 className="font-semibold">3. Add context and generate</h2><p className="mt-1 text-sm text-muted-foreground">Start from scratch or paste an existing draft. Personalization variables are preserved.</p></div></div>
            <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Optional existing subject" data-testid="ai-writer-subject" /></div>
            <div className="space-y-1.5"><Label>Email body</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} placeholder={"Hi {{first_name}},\n\nWrite your existing draft here, or leave blank to start from scratch."} data-testid="ai-writer-body" /></div>
            <div className="space-y-1.5"><Label>Preheader (optional)</Label><Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Short preview text" /></div>
            <Button className="w-full" onClick={generate} disabled={generating || !profile}><Sparkles className="size-4" />{generating ? "Generating email…" : "Generate personalized email"}<ArrowRight className="size-4" /></Button>
            {!profile && <p className="text-xs text-muted-foreground">Read your website first to enable website-aware generation.</p>}
          </section>

          {draft && <section className="rounded-xl border border-primary/30 bg-panel p-5 space-y-4" data-testid="ai-writer-preview">
            <div className="flex items-center gap-2 font-semibold"><Wand2 className="size-4 text-primary" /> Your AI draft</div>
            <div className="space-y-1"><Label>Subject</Label><div className="rounded-lg border border-border bg-background p-3 text-sm">{draft.subject || "—"}</div></div>
            <div className="space-y-1"><Label>Preheader</Label><div className="rounded-lg border border-border bg-background p-3 text-sm">{draft.preheader || "—"}</div></div>
            <div className="space-y-1"><Label>Body</Label><pre className="whitespace-pre-wrap rounded-lg border border-border bg-background p-3 font-sans text-sm">{draft.body}</pre></div>
            <div className="flex flex-wrap gap-2"><Button onClick={applyDraft}><Check className="size-4" /> Edit this draft</Button><Button variant="outline" onClick={generate} disabled={generating}><RefreshCw className="size-4" /> Regenerate</Button></div>
            <p className="text-xs text-muted-foreground">Review all claims and personalization tokens before using this email in a campaign.</p>
          </section>}
        </div>
      </div>
    </AppShell>
  );
}
