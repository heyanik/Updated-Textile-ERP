import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { getGasUrl } from "@/lib/gas";
import { getSession } from "@/lib/auth";
import { isUnlocked } from "@/lib/license";

export const Route = createFileRoute("/_app")({
  beforeLoad: ({ location }) => {
    if (typeof window !== "undefined" && !isUnlocked() && location.pathname !== "/unlock") {
      throw redirect({ to: "/unlock" });
    }
    if (typeof window !== "undefined" && !getGasUrl() && location.pathname !== "/setup") {
      throw redirect({ to: "/setup" });
    }
    if (typeof window !== "undefined" && getGasUrl() && !getSession()) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppLayout,
});
