import { createFileRoute } from "@tanstack/react-router";

import { env } from "@/env/server";
import { runAutoReplyCycleForAllEnabledUsers } from "@/lib/youtube/auto-reply";

export const Route = createFileRoute("/api/cron/$")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!env.CRON_SECRET) {
          return Response.json({ error: "CRON_SECRET not configured on server" }, { status: 500 });
        }

        const xSecret = request.headers.get("x-cron-secret");
        const authHeader = request.headers.get("authorization");
        const bearerSecret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
        const secret = xSecret ?? bearerSecret;

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
