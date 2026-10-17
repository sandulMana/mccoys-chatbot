import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isRecoveryLink, recoveryLinkError } from "@/lib/password-recovery";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Reset password · McCoy's Brand Studio" },
    { name: "description", content: "Set a new password for your McCoy's Brand Studio account." },
    { property: "og:title", content: "Reset password · McCoy's Brand Studio" },
    { property: "og:description", content: "Set a new password for your McCoy's Brand Studio account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const hash = window.location.hash;
    const linkError = recoveryLinkError(hash);
    const recovery = isRecoveryLink(hash) || sessionStorage.getItem("mccoys-password-recovery") === "active";
    async function check() {
      if (linkError || !recovery) {
        if (active) { setError(linkError ?? "Open the password reset link from your email to set a new password."); setChecking(false); }
        return;
      }
      const { data, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !data.user) {
        sessionStorage.removeItem("mccoys-password-recovery");
        setError("This password reset link has expired or is invalid. Request a new link.");
      } else {
        sessionStorage.setItem("mccoys-password-recovery", "active");
        setReady(true);
      }
      setChecking(false);
    }
    void check();
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    setBusy(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      sessionStorage.removeItem("mccoys-password-recovery");
      const { queryClient } = Route.useRouteContext;
      await navigate({ to: "/studio", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password. Please try again.");
    } finally { setBusy(false); }
  }

  return <div className="grid min-h-screen place-items-center bg-sidebar px-4">
    <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl">
      <img src="/mccoys-logo.png" alt="McCoy's Building Supply" className="mx-auto h-16 w-32 object-contain" />
      <h1 className="my-4 text-center text-4xl text-primary">Reset password</h1>
      {checking && <p role="status" className="text-sm text-muted-foreground">Checking your reset link…</p>}
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {ready && <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={busy}>{busy ? "Saving…" : "Save new password"}</Button>
      </form>}
      <Button asChild variant="link" className="mt-4 w-full"><Link to="/auth">Back to sign in</Link></Button>
    </div>
  </div>;
}