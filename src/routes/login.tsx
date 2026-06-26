import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { gas, getGasUrl } from "@/lib/gas";
import { setSession, type AuthSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { isUnlocked } from "@/lib/license";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isUnlocked()) throw redirect({ to: "/unlock" });
  },
  head: () => ({ meta: [{ title: "Sign in — Textile ERP" }] }),
  component: Login,
});

function Login() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!getGasUrl()) {
      toast.error("Connect to backend first in Setup");
      nav({ to: "/setup" });
      return;
    }
    setBusy(true);
    try {
      const data = await gas<AuthSession>("loginUser", { username, password });
      setSession(data);
      toast.success(`Welcome, ${data.username}`);
      nav({ to: "/" });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Textile ERP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
          </div>
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={busy || !username || !password}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            No account? Create the first user in{" "}
            <a href="/setup" className="underline">
              Setup
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
