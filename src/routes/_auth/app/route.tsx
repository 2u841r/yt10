import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_auth/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center gap-4 px-3 py-6">
      <div className="flex w-full max-w-5xl justify-between">
        <div className="flex items-center gap-1">
          <Button render={<Link to="/" />} size="sm" nativeButton={false}>
            back to home
          </Button>
        </div>
        <ThemeToggle />
      </div>
      <div className="w-full max-w-5xl rounded-3xl border bg-card p-4 shadow-sm">
        <Outlet />
      </div>

      <div className="flex w-full max-w-5xl flex-wrap justify-end gap-2 text-sm">
        <SignOutButton />
      </div>
    </div>
  );
}
