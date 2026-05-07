import { createFileRoute } from "@tanstack/react-router";

import { env } from "@/env/server";
import { runAutoReplyCycleForAllEnabledUsers } from "@/lib/youtube/auto-reply";

export const Route = createFileRoute("/api/cron/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = request.headers.get("x-cron-secret");

        if (!env.CRON_SECRET) {
          return Response.json({ error: "CRON_SECRET not configured on server" }, { status: 500 });
        }

        if (!secret || secret !== env.CRON_SECRET) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const results = await runAutoReplyCycleForAllEnabledUsers();
          return Response.json({ results });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
