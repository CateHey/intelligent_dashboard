import { getAdmin } from "./supabase";
import { TENANT_ID, DEMO_MODE } from "./config";
import type { ChartType } from "./types";

export interface CachedQuery {
  sql_generated: string;
  chart: ChartType;
  title: string;
}

// Busca en caché por pregunta normalizada. Devuelve sql+chart+title (NO datos).
export async function getCache(questionNorm: string): Promise<CachedQuery | null> {
  if (DEMO_MODE) {
    const { demoQuery } = await import("./demo/db");
    const rows = await demoQuery(
      `select sql_generated, chart, title from dashboard_query_cache
       where tenant_id = $1 and question_norm = $2 limit 1`,
      [TENANT_ID, questionNorm]
    );
    const row = rows[0] as any;
    if (!row) return null;
    return {
      sql_generated: row.sql_generated,
      chart: (row.chart as ChartType) || "table",
      title: row.title || "Resultado",
    };
  }

  const { data, error } = await getAdmin()
    .from("dashboard_query_cache")
    .select("sql_generated, chart, title")
    .eq("tenant_id", TENANT_ID)
    .eq("question_norm", questionNorm)
    .maybeSingle();

  if (error || !data) return null;
  return {
    sql_generated: data.sql_generated,
    chart: (data.chart as ChartType) || "table",
    title: data.title || "Resultado",
  };
}

// Guarda la traducción (no los datos). Upsert por (tenant, question_norm).
export async function setCache(
  questionNorm: string,
  sql: string,
  chart: ChartType,
  title: string
): Promise<void> {
  if (DEMO_MODE) {
    const { demoQuery } = await import("./demo/db");
    await demoQuery(
      `insert into dashboard_query_cache (tenant_id, question_norm, sql_generated, chart, title)
       values ($1,$2,$3,$4,$5)
       on conflict (tenant_id, question_norm)
       do update set sql_generated = excluded.sql_generated,
                     chart = excluded.chart,
                     title = excluded.title`,
      [TENANT_ID, questionNorm, sql, chart, title]
    );
    return;
  }

  await getAdmin().from("dashboard_query_cache").upsert(
    {
      tenant_id: TENANT_ID,
      question_norm: questionNorm,
      sql_generated: sql,
      chart,
      title,
    },
    { onConflict: "tenant_id,question_norm" }
  );
}
