import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, KeyRound, Loader2, Mail, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import AppShell, { PageHeader } from "@/components/AppShell";
import { Panel } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/format";
import type { User } from "@/lib/types";

export default function Settings() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => apiGet<User>("/auth/me"), retry: false });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const profile = useMutation({
    mutationFn: () => apiPatch<User>("/auth/account", { name: name.trim(), email: email.trim(), current_password: profilePassword }),
    onSuccess: async (user) => {
      await qc.setQueryData(["me"], user);
      await qc.invalidateQueries({ queryKey: ["me"] });
      setProfilePassword("");
      toast.success("Account details updated");
    },
  });
  const password = useMutation({
    mutationFn: () => apiPost<{ ok: boolean }>("/auth/password", { current_password: currentPassword, new_password: newPassword }),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    },
  });

  const user = me.data;
  useEffect(() => {
    if (user) { setName(user.name); setEmail(user.email); }
  }, [user?.id]);
  const submitProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!profilePassword) return toast.error("Enter your current password to confirm these changes");
    profile.mutate();
  };
  const submitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("New passwords do not match");
    if (newPassword.length < 8) return toast.error("Use at least 8 characters for your new password");
    password.mutate();
  };

  return (
    <AppShell>
      <PageHeader eyebrow="Workspace preferences" title="Account settings" subtitle="Manage your profile, sign-in email, and password." />
      <div className="grid max-w-4xl gap-5">
        <Panel title="Profile & email" testId="settings-profile-panel">
          <form onSubmit={submitProfile} className="space-y-5 p-5 sm:p-6">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-4">
              <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{user?.name ?? "Your account"}</p>
                <p className="truncate text-sm text-muted-foreground">{user?.email ?? "Loading account…"}</p>
              </div>
              <BadgeCheck className="size-5 text-emerald-400" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-name">Full name</Label>
                <Input id="settings-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} autoComplete="name" data-testid="settings-name-input" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-email">Account email</Label>
                <Input id="settings-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" data-testid="settings-email-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-profile-password">Current password (required to save)</Label>
              <Input id="settings-profile-password" type="password" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} required autoComplete="current-password" placeholder="Confirm it's you" data-testid="settings-profile-current-password" />
              <p className="text-xs text-muted-foreground">We ask for your current password before changing your account email.</p>
            </div>
            {profile.isError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errMsg(profile.error, "Could not update account details")}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={profile.isPending || !user} data-testid="settings-save-profile">
                {profile.isPending ? <Loader2 className="size-4 animate-spin" /> : <><Mail className="size-4" /> Save profile</>}
              </Button>
            </div>
          </form>
        </Panel>

        <Panel title="Change password" testId="settings-password-panel">
          <form onSubmit={submitPassword} className="space-y-5 p-5 sm:p-6">
            <div className="flex items-start gap-3 rounded-xl border border-border bg-background/50 p-4">
              <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ShieldCheck className="size-5" /></div>
              <div><p className="text-sm font-medium text-foreground">Keep your account secure</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Use a unique password with at least 8 characters. Your current password is required to make this change.</p></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settings-current-password">Current password</Label>
              <Input id="settings-current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" data-testid="settings-current-password" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="settings-new-password">New password</Label>
                <Input id="settings-new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" data-testid="settings-new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="settings-confirm-password">Confirm new password</Label>
                <Input id="settings-confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" data-testid="settings-confirm-password" />
              </div>
            </div>
            {password.isError && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">{errMsg(password.error, "Could not change password")}</p>}
            <div className="flex justify-end">
              <Button type="submit" disabled={password.isPending} data-testid="settings-change-password">
                {password.isPending ? <Loader2 className="size-4 animate-spin" /> : <><KeyRound className="size-4" /> Update password</>}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </AppShell>
  );
}
