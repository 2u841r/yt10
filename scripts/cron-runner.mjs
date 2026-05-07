import "dotenv/config";

const BASE_URL = process.env.VITE_BASE_URL || "http://localhost:3001";
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error("CRON_SECRET is not set. Set it in .env");
  process.exit(1);
}

const INTERVAL_MS = 30_000;

async function ping() {
  const ts = new Date().toISOString();
  try {
    const res = await fetch(`${BASE_URL}/api/cron/$`, {
      headers: { "x-cron-secret": CRON_SECRET },
    });
    const body = await res.json();
    const results = body.results ?? [];
    const ran = results.filter((r) => !r.skipped).length;
    const skipped = results.filter((r) => r.skipped).length;
    console.log(`${ts} | status=${res.status} | ran=${ran} | skipped=${skipped}`);
  } catch (err) {
    console.error(`${ts} | error: ${err.message}`);
  }
}

console.log(`Cron runner started (polling ${BASE_URL}/api/cron/$ every ${INTERVAL_MS / 1000}s)`);
ping();
setInterval(ping, INTERVAL_MS);
