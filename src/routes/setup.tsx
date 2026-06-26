import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getGasUrl, setGasUrl, gas } from "@/lib/gas";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { isUnlocked } from "@/lib/license";

export const Route = createFileRoute("/setup")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && !isUnlocked()) throw redirect({ to: "/unlock" });
  },
  head: () => ({ meta: [{ title: "Setup — Textile ERP" }] }),
  component: Setup,
});

function Setup() {
  const [url, setUrl] = useState(getGasUrl() ?? "");
  const [testing, setTesting] = useState(false);
  const navigate = useNavigate();
  const [connected, setConnected] = useState(!!getGasUrl());
  const [users, setUsers] = useState<Array<{ username: string; role: string; created_at: string }>>(
    [],
  );
  const [newU, setNewU] = useState({ username: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function loadUsers() {
    try {
      const u =
        await gas<Array<{ username: string; role: string; created_at: string }>>("listUsers");
      setUsers(u);
    } catch {
      // backend may be unreachable
    }
  }

  useEffect(() => {
    if (connected) loadUsers();
  }, [connected]);

  async function addUser() {
    if (!newU.username || !newU.password) return;
    setBusy(true);
    try {
      await gas("registerUser", newU);
      toast.success(`User ${newU.username} created`);
      setNewU({ username: "", password: "" });
      loadUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unable to create user.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(username: string) {
    if (!confirm(`Delete user ${username}?`)) return;
    try {
      await gas("deleteUser", { username });
      loadUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unable to delete user.");
    }
  }

  async function save() {
    if (!/^https:\/\/script\.google\.com\/.+\/exec/.test(url)) {
      toast.error("Enter a valid Apps Script /exec URL");
      return;
    }
    setGasUrl(url);
    setTesting(true);
    try {
      await gas("init");
      toast.success("Connected — sheets initialized");
      setConnected(true);
      loadUsers();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Unable to connect to Apps Script.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Textile ERP — Setup</h1>
          <p className="text-muted-foreground mt-2">
            Paste your Google Apps Script Web App URL to connect.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Connect</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="https://script.google.com/macros/s/AKfy.../exec"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <Button onClick={save} disabled={testing}>
              {testing ? "Connecting…" : "Save & Connect"}
            </Button>
          </CardContent>
        </Card>

        {connected && (
          <Card>
            <CardHeader>
              <CardTitle>User Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <div>
                  <Label>Username</Label>
                  <Input
                    value={newU.username}
                    onChange={(e) => setNewU({ ...newU, username: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={newU.password}
                    onChange={(e) => setNewU({ ...newU, password: e.target.value })}
                  />
                </div>
                <Button onClick={addUser} disabled={busy || !newU.username || !newU.password}>
                  {users.length === 0 ? "Create first user (admin)" : "Add user"}
                </Button>
              </div>
              <div className="rounded-md border divide-y">
                {users.length === 0 && (
                  <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                    No users yet — create one above.
                  </div>
                )}
                {users.map((u) => (
                  <div key={u.username} className="flex items-center justify-between px-4 py-2">
                    <div>
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.role} · {u.created_at}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeUser(u.username)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Go to{" "}
                <a href="/login" className="underline">
                  /login
                </a>{" "}
                after creating your first user.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
