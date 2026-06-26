import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { tryUnlock, requiredMonth } from "@/lib/license";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export const Route = createFileRoute("/unlock")({
  head: () => ({ meta: [{ title: "App Locked — Textile ERP" }] }),
  component: Unlock,
});

function Unlock() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const month = requiredMonth();

  function submit() {
    if (tryUnlock(password)) {
      toast.success("App unlocked");
      nav({ to: "/" });
    } else {
      toast.error("Incorrect password. Contact your provider.");
      setPassword("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-destructive" />
          </div>
          <CardTitle>App Locked</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the monthly access password for <span className="font-mono">{month}</span>.
            Contact your service provider to obtain it.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Access Password</Label>
            <Input
              type="password"
              value={password}
              autoFocus
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={!password}>
            Unlock
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
