import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, Save, ShieldCheck, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { errMsg } from "@/lib/format";

type SettingsData = {provider:"gemini"|"groq";model:string;has_api_key:boolean;models:string[];encryption_configured:boolean};
export default function AIProviderPanel(){
 const qc=useQueryClient();
 const q=useQuery({queryKey:["ai-provider-settings"],queryFn:()=>apiGet<SettingsData>("/ai/provider-settings")});
 const [provider,setProvider]=useState<"gemini"|"groq">("gemini");
 const [model,setModel]=useState("openai/gpt-oss-120b");
 const [apiKey,setApiKey]=useState("");
 useEffect(()=>{if(q.data){setProvider(q.data.provider);setModel(q.data.model||"openai/gpt-oss-120b");}},[q.data]);
 const save=useMutation({mutationFn:()=>apiPut("/ai/provider-settings",{provider,model,api_key:apiKey}),onSuccess:async()=>{setApiKey("");await qc.invalidateQueries({queryKey:["ai-provider-settings"]});toast.success("AI provider settings saved");},onError:e=>toast.error(errMsg(e))});
 const test=useMutation({mutationFn:()=>apiPost<{message:string}>("/ai/provider-settings/test",{}),onSuccess:r=>toast.success(r.message),onError:e=>toast.error(errMsg(e))});
 return <Panel title={<span className="flex items-center gap-2"><Bot className="size-4 text-primary"/> AI provider</span>} testId="settings-ai-provider-panel">
  <div className="space-y-5 p-5 sm:p-6">
   <div className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-4"><ShieldCheck className="mt-0.5 size-5 text-emerald-400"/><div><p className="text-sm font-medium">Your API key stays private</p><p className="mt-1 text-xs text-muted-foreground">Groq keys are encrypted before storage and never sent back to your browser.</p></div></div>
   <div className="space-y-1.5"><Label>AI provider</Label><Select value={provider} onValueChange={v=>setProvider(v as "gemini"|"groq")}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="gemini">Google Gemini (existing)</SelectItem><SelectItem value="groq">Groq</SelectItem></SelectContent></Select></div>
   {provider==="groq"&&<><div className="space-y-1.5"><Label>Groq API key</Label><Input type="password" autoComplete="new-password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder={q.data?.has_api_key?"Saved key — leave blank to keep it":"gsk_..."}/></div><div className="space-y-1.5"><Label>Model</Label><Select value={model} onValueChange={setModel}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{(q.data?.models??["openai/gpt-oss-120b","qwen/qwen3-32b"]).map(m=><SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>{!q.data?.encryption_configured&&<p className="text-xs text-amber-400">Backend setup required: add AI_CREDENTIALS_ENCRYPTION_KEY to Render before saving a Groq key.</p>}</>}
   {provider==="gemini"&&<p className="text-sm text-muted-foreground">Uses the existing Gemini backend configuration.</p>}
   <div className="flex flex-wrap justify-end gap-2">{provider==="groq"&&<Button type="button" variant="outline" onClick={()=>test.mutate()} disabled={test.isPending||!q.data?.has_api_key}>{test.isPending?<Loader2 className="size-4 animate-spin"/>:<Wifi className="size-4"/>} Test connection</Button>}<Button type="button" onClick={()=>save.mutate()} disabled={save.isPending||(provider==="groq"&&!q.data?.encryption_configured)}>{save.isPending?<Loader2 className="size-4 animate-spin"/>:<Save className="size-4"/>} Save provider</Button></div>
   {q.data?.provider==="groq"&&<p className="text-xs text-emerald-400">Groq is selected for website research and AI email generation.</p>}
  </div>
 </Panel>;
}
