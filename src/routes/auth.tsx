import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · McCoy's Brand Studio" },
      { name: "description", content: "Sign in to create on-brand McCoy's marketing materials." },
      { property: "og:title", content: "Sign in · McCoy's Brand Studio" },
      { property: "og:description", content: "Sign in to create on-brand McCoy's marketing materials." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up" | "reset">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/studio", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const normalizedEmail = email.trim();
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (error) throw error;
        await navigate({ to: "/studio", replace: true });
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("If an account exists for this email, a password reset link has been sent. Check your inbox and spam folder.");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (data.session) await navigate({ to: "/studio", replace: true });
        else setNotice("Check your email to confirm your account. If you already have an account, sign in or reset your password instead.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message === "Invalid login credentials" ? "Email or password is incorrect. Try again, reset your password, or use the Google account you signed up with." : message);
    } finally {
      setBusy(false);
    }
  }

  async function oauth(p: "google" | "lovable") {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
    if (r.error) toast.error(r.error.message ?? "Sign-in failed");
    else {
      const { data } = await supabase.auth.getUser();
      if (data.user) await navigate({ to: "/studio", replace: true });
    }
  }

  function changeMode(next: "in" | "up" | "reset") {
    setMode(next); setError(null); setNotice(null); setPassword("");
  }

  return (
    <div className="grid min-h-screen place-items-center bg-sidebar px-4">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl">
        <img src="/mccoys-logo.png" alt="McCoy's Building Supply" className="mx-auto h-16 w-32 object-contain" />
        <h1 className="mt-4 text-center text-4xl text-primary">Brand Studio</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          {mode === "in" ? "Sign in to create on-brand flyers." : mode === "reset" ? "Reset your account password." : "Create your manager account."}
        </p>
        {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="mb-4 text-sm text-primary">{notice}</p>}
        <form onSubmit={submit} className="space-y-3">
          {mode === "up" && (
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          {mode !== "reset" && <div className="space-y-1">
            <Label htmlFor="pw">Password</Label>
            <Input id="pw" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} minLength={mode === "up" ? 6 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "in" ? "Sign in" : mode === "reset" ? "Send reset link" : "Create account"}
          </Button>
        </form>
        {mode === "in" && <Button variant="link" className="mt-2 w-full" disabled={busy} onClick={() => changeMode("reset")}>Forgot password?</Button>}
        {mode !== "reset" && <>
        <div className="my-4 text-center text-xs text-muted-foreground">or</div>
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => oauth("google")}>
            Continue with Google
          </Button>
          <Button type="button" variant="outline" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>
            Continue with Lovable
          </Button>
        </div>
        </>}
        <Button
          type="button"
          variant="link"
          disabled={busy}
          className="mt-6 w-full text-center text-sm text-primary underline-offset-4 hover:underline"
          onClick={() => changeMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "New here? Create an account" : mode === "reset" ? "Back to sign in" : "Already have an account? Sign in"}
        </Button>
      </div>
    </div>
  );
}
