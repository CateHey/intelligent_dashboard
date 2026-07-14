import { getAdmin } from "./supabase";
import { TENANT_ID, RATE_LIMIT_PER_MIN, DEMO_MODE } from "./config";

// Rate-limit por tenant basado en el log (robusto entre instancias serverless):
// cuenta cuántas consultas hubo en los últimos 60s.
export async function isRateLimited(): Promise<boolean> {
  if (DEMO_MODE) {
    try {
      const { demoQuery } = await import("./demo/db");
      const rows = await demoQuery(
        `select count(*)::int as c from dashboard_query_log
         where tenant_id = $1 and created_at > now() - interval '60 seconds'`,
        [TENANT_ID]
      );
      const c = Number((rows[0] as any)?.c ?? 0);
      return c >= RATE_LIMIT_PER_MIN;
    } catch {
      return false;
    }
  }

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await getAdmin()
    .from("dashboard_query_log")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .gte("created_at", since);

  if (error || count == null) return false; // ante la duda, no bloquea
  return count >= RATE_LIMIT_PER_MIN;
}
