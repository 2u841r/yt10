import "@tanstack/react-start/server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { env } from "@/env/server";
import * as schema from "@/lib/db/schema";

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_AUTH_TOKEN,
});

export const db = drizzle({
  client,
  schema,
  casing: "snake_case",
});
