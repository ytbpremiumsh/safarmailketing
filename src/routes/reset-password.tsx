import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { recoveryCredentials } from "@/lib/auth-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [
    { title: "Atur ulang password — Safar Mail" },
    { name: "description", content: "Pemulihan password akun Safar Mail melalui tautan email terverifikasi." },
    { property: "og:title", content: "Atur ulang password — Safar Mail" },
    { property: "og:description", content: "Pulihkan akses akun Safar Mail dengan aman." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const credentials = recoveryCredentials(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname);
    const verify = async () => {
      try {
        if (!credentials) throw new Error("invalid recovery");
        const { error: sessionError } = await supabase.auth.setSession(credentials);
        if (sessionError) throw sessionError;
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError || !data.user) throw new Error("invalid recovery");
        if (!cancelled) setValid(true);
      } catch {
        if (!cancelled) setError("Tautan tidak valid atau sudah kedaluwarsa. Minta tautan baru melalui Lupa password.");
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid || busy || password.length < 8 || password !== confirmation) return;
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError("Password belum bisa diperbarui. Gunakan password lain atau minta tautan pemulihan baru.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut();
    localStorage.removeItem("safar-session");
    setPassword("");
    setConfirmation("");
    setDone(true);
    setBusy(false);
  };

  return <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12 text-foreground">
    <div className="w-full max-w-sm space-y-6">
      <KeyRound className="text-primary" size={32} />
      <h1 className="text-2xl font-bold">Atur ulang password</h1>
      {!ready && <Loader2 aria-label="Memeriksa tautan" className="animate-spin text-primary" />}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {done ? <p role="status">Password berhasil diperbarui. Silakan masuk dengan password baru.</p> : ready && valid &&
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2"><Label htmlFor="new-password">Password baru</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></div>
          <div className="space-y-2"><Label htmlFor="confirm-password">Ulangi password baru</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>
          {confirmation && password !== confirmation && <p className="text-sm text-destructive">Password belum sama.</p>}
          <Button className="w-full bg-primary text-primary-foreground" type="submit" disabled={busy || password.length < 8 || password !== confirmation}>{busy ? <Loader2 className="animate-spin" /> : <KeyRound />}Simpan password</Button>
        </form>}
      <Button asChild variant="link"><Link to="/">Kembali ke login</Link></Button>
    </div>
  </main>;
}