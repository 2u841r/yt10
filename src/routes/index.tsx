import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "@/components/landing-page";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  /**
   * This is the intro component for TanStarter,
   * which you may delete after creating the project,
   * and replace it with your own homepage or landing page.
   *
   * Have fun!
   */
  return <LandingPage />;
}
