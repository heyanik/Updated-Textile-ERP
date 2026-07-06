import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ClipboardCheck,
  Wallet,
  Package,
  FileText,
  Droplet,
  Settings,
  Building2,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clearSession, getSession } from "@/lib/auth";
import { useEffect, useState } from "react";
import logoUrl from "@/assets/logo.png";
import { needsRenewal, tryUnlock, nextMonth, daysLeftInMonth } from "@/lib/license";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Employees", icon: Users },
  { to: "/attendance", label: "Attendance", icon: ClipboardCheck },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/inventory", label: "Inventory", icon: Package },
  { to: "/clients", label: "Clients", icon: Building2 },
  // { to: "/invoices", label: "Invoices", icon: FileText },
  { to: "/ink", label: "Ink", icon: Droplet },
] as const;

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const session = typeof window !== "undefined" ? getSession() : null;
  const [showRenewal, setShowRenewal] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewPw, setRenewPw] = useState("");

  useEffect(() => {
    const check = () => setShowRenewal(needsRenewal());
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [pathname]);

  function submitRenew() {
    if (tryUnlock(renewPw)) {
      toast.success("Renewed for next month");
      setRenewPw("");
      setRenewOpen(false);
      setShowRenewal(needsRenewal());
    } else {
      toast.error("Incorrect password");
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside className="w-60 border-r bg-card flex flex-col">
        <div className="px-5 py-5 border-b">
          <div className="flex items-center gap-3">
            <img
              src={logoUrl}
              alt="Company logo"
              className="h-9 w-9 rounded-md border bg-white/80 object-contain p-1"
            />
            <div>
              <div className="text-lg font-semibold tracking-tight">Textile ERP</div>
              <div className="text-xs text-muted-foreground">Operations Console</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Link
            to="/setup"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="size-4" />
            Setup
          </Link>
          {session && (
            <button
              onClick={() => {
                clearSession();
                navigate({ to: "/login" });
              }}
              className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LogOut className="size-4" />
              <span className="flex-1 text-left">Log out</span>
              <span className="text-[10px] uppercase tracking-wide">{session.username}</span>
            </button>
          )}
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {showRenewal && (
          <button
            onClick={() => setRenewOpen(true)}
            className="w-full flex items-center gap-3 bg-destructive/10 border-b border-destructive/30 text-destructive px-6 py-3 text-sm hover:bg-destructive/15 transition"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span className="text-left flex-1">
              <strong>Renewal required.</strong> The app will lock in {daysLeftInMonth() + 1}{" "}
              day(s). Enter the access password for <span className="font-mono">{nextMonth()}</span>{" "}
              to continue using it next month.
            </span>
            <span className="underline">Enter password</span>
          </button>
        )}
        <Outlet />
      </main>
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="fixed bottom-3 right-3 z-50 rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium shadow-md hover:shadow-lg transition"
      >
        Build By Anik
      </a>
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew access</DialogTitle>
            <DialogDescription>
              Enter the access password for <span className="font-mono">{nextMonth()}</span>.
              Contact your service provider to obtain it.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            autoFocus
            value={renewPw}
            onChange={(e) => setRenewPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitRenew()}
            placeholder="Access password"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenewOpen(false)}>
              Later
            </Button>
            <Button onClick={submitRenew} disabled={!renewPw}>
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b px-8 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action}
    </div>
  );
}
