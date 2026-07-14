import { getAdmin } from "./supabase";
import { DEMO_MODE } from "./config";
import type { Row } from "./types";

// Ejecuta un SELECT ya validado por el portero.
// - Producción: exec_read_sql en Supabase (corre con el rol dashboard_readonly).
// - Demo: PGlite embebido. El portero sigue activo; acá re-chequeamos SELECT.
export async function runReadSql(sql: string): Promise<Row[]> {
  if (DEMO_MODE) {
    if (!/^\s*select/i.test(sql)) throw new Error("Solo se permiten consultas SELECT");
    const { demoQuery } = await import("./demo/db");
    return demoQuery(sql);
  }

  const { data, error } = await getAdmin().rpc("exec_read_sql", { query: sql });
  if (error) {
    throw new Error(error.message || "error ejecutando consulta");
  }
  // exec_read_sql devuelve jsonb_agg -> array (o [] si no hay filas).
  return (data as Row[]) ?? [];
}
