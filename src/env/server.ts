import { createEnv } from "@t3-oss/env-core";
import * as z from "zod";

export const env = createEnv({
  server: {
    TURSO_DATABASE_URL: z.string().min(1),
    TURSO_AUTH_TOKEN: z.string().min(1).optional(),
    VITE_BASE_URL: z.url().default("http://localhost:3333"),
    BETTER_AUTH_SECRET: z.string().min(1),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    OPENROUTER_MODEL: z.string().min(1).optional(),

    // OAuth2 providers, optional, update as needed
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    // Cron secret for protecting automated endpoints
    CRON_SECRET: z.string().optional(),
  },
  runtimeEnv: process.env,
});
