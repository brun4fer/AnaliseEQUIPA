"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

import { Button, Input, Label, Panel } from "@/components/ui";

const ssoMessages: Record<string, string> = {
  unavailable: "Single sign-on is not configured yet. Use the local login below.",
  invalid: "The single sign-on request was invalid. Please try again from the portal.",
  expired: "The single sign-on code expired or was already used. Please try again.",
  unlinked: "This portal account is not linked to an existing account in this application.",
  failed: "The portal could not be reached. Use the local login or try again shortly."
};

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [ssoError, setSsoError] = useState("");
  const [busy, setBusy] = useState(false);
  const ssoEnabled = process.env.NEXT_PUBLIC_SSO_ENABLED === "true";

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("sso");
    setSsoError(reason ? ssoMessages[reason] || "Single sign-on could not be completed." : "");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
    const data = await response.json() as { error?: string; mustChangePassword?: boolean; needsOnboarding?: boolean };
    setBusy(false);
    if (!response.ok) return setError(data.error || "Could not sign in.");
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(data.mustChangePassword ? "/change-password" : data.needsOnboarding ? "/onboarding" : next || "/");
    router.refresh();
  }

  return <div className="flex min-h-screen items-center justify-center px-4"><Panel className="w-full max-w-md p-7">
    <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><LockKeyhole /></span>
    <h1 className="mt-5 text-2xl font-semibold text-white">AP - our team performance</h1>
    <p className="mt-2 text-sm text-slate-400">Sign in to access your team&apos;s private matches, videos and analysis data.</p>
    {ssoError ? <div className="mt-5 rounded-lg border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">{ssoError}</div> : null}
    {error ? <div className="mt-5 rounded-lg border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-100">{error}</div> : null}
    {ssoEnabled ? <>
      <Link href="/api/auth/sso/start" className="mt-6 flex h-11 items-center justify-center rounded-lg border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/15">Sign in with AP Portal</Link>
      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.16em] text-slate-600"><span className="h-px flex-1 bg-slate-700/70"/><span>or local login</span><span className="h-px flex-1 bg-slate-700/70"/></div>
    </> : null}
    <form onSubmit={submit} className="mt-6 grid gap-4">
      <label className="grid gap-2"><Label>Username</Label><Input type="text" autoCapitalize="none" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
      <label className="grid gap-2"><Label>Password</Label><Input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <Button variant="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
    <p className="mt-5 text-center text-sm text-slate-500">Don&apos;t have an account yet? <Link href="/register" className="font-medium text-cyan-300 hover:text-cyan-200">Create account</Link></p>
  </Panel></div>;
}
