import { getAdmin } from "./supabase";
import { TENANT_ID, DEMO_MODE } from "./config";

export interface LogEntry {
  question: string;
  sql: string | null;
  approved: boolean;
  reject_reason: string | null;
  row_count: number;
  latency_ms: number;
}

// Auditoría: registra cada pregunta y su veredicto. No debe romper la respuesta.
export async function logQuery(entry: LogEntry): Promise<void> {
  try {
    if (DEMO_MODE) {
      const { demoQuery } = await import("./demo/db");
      await demoQuery(
        `insert into dashboard_query_log
           (tenant_id, question, sql_generated, approved, reject_reason, row_count, latency_ms)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [
          TENANT_ID,
          entry.question,
          entry.sql,
          entry.approved,
          entry.reject_reason,
          entry.row_count,
          entry.latency_ms,
        ]
      );
      return;
    }

    await getAdmin().from("dashboard_query_log").insert({
      tenant_id: TENANT_ID,
      question: entry.question,
      sql_generated: entry.sql,
      approved: entry.approved,
      reject_reason: entry.reject_reason,
      row_count: entry.row_count,
      latency_ms: entry.latency_ms,
    });
  } catch {
    // Logging best-effort: si falla, no interrumpimos al usuario.
  }
}
