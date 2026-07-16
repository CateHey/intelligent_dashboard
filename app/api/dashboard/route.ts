import { NextResponse } from "next/server";
import { runReadSql } from "@/lib/exec";
import { generateTip } from "@/lib/claude";
import { localSummary } from "@/lib/localAi";
import { DEMO_MODE, HAS_CLAUDE, assertConfigured } from "@/lib/config";
import type { DashboardData, Row } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// SQL fijo (no viene de Claude). Solo lee v_dashboard. Es el camino "sin IA".
// OJO: "ingresos" = SOLO jobs Completed. Los Quote (presupuestos sin cerrar) y los
// Unsuccessful (presupuestos perdidos) tienen monto cargado pero NO son plata que
// entró — contarlos inflaba la facturación ~4x.
const SQL_KPIS = `
select
  count(*)::int as total_jobs,
  (count(*) filter (where estado = 'Completed'))::int as completados,
  (count(*) filter (where estado = 'Work Order'))::int as work_order,
  coalesce(sum(monto) filter (
    where estado = 'Completed'
      and date_trunc('month', fecha) = date_trunc('month', now())
  ), 0)::numeric as ingresos_mes
from v_dashboard`.trim();

const SQL_ESTADOS = `
select estado, count(*)::int as total
from v_dashboard
where estado is not null
group by estado
order by total desc
limit 12`.trim();

const SQL_TECNICOS = `
select tecnico, count(*)::int as total
from v_dashboard
where tecnico is not null
group by tecnico
order by total desc
limit 12`.trim();

// Ingresos reales por mes: solo Completed (ver nota en SQL_KPIS).
const SQL_INGRESOS = `
select to_char(date_trunc('month', fecha), 'YYYY-MM') as mes, coalesce(sum(monto), 0)::numeric as total
from v_dashboard
where fecha is not null and estado = 'Completed'
group by date_trunc('month', fecha)
order by date_trunc('month', fecha)
limit 12`.trim();

// GET /api/dashboard — datos base para el Modo 0.
export async function GET() {
  try {
    assertConfigured();

    const [kpisRows, estados, tecnicos, ingresos] = await Promise.all([
      runReadSql(SQL_KPIS),
      runReadSql(SQL_ESTADOS),
      runReadSql(SQL_TECNICOS),
      runReadSql(SQL_INGRESOS),
    ]);

    const k = (kpisRows[0] as Row) || {};
    const kpis = {
      total_jobs: Number(k.total_jobs ?? 0),
      completados: Number(k.completados ?? 0),
      work_order: Number(k.work_order ?? 0),
      ingresos_mes: Number(k.ingresos_mes ?? 0),
    };

    // Tip de resumen sobre datos reales (best-effort).
    // Sin Claude usamos un resumen calculado (no la heurística genérica, que
    // mezclaría conteos con montos y daría una conclusión sin sentido).
    let tip = "";
    try {
      tip = HAS_CLAUDE
        ? await generateTip("Resumen general del estado del negocio hoy", [
            { metrica: "total_jobs", valor: kpis.total_jobs },
            { metrica: "completados", valor: kpis.completados },
            { metrica: "work_order", valor: kpis.work_order },
            { metrica: "ingresos_mes_aud", valor: kpis.ingresos_mes },
            ...estados.map((e) => ({
              metrica: `estado:${e.estado}`,
              valor: Number(e.total),
            })),
            ...tecnicos.slice(0, 5).map((t) => ({
              metrica: `tecnico:${t.tecnico}`,
              valor: Number(t.total),
            })),
          ])
        : localSummary(kpis, tecnicos);
    } catch {
      tip = "";
    }

    const payload: DashboardData = {
      kpis,
      estados,
      tecnicos,
      ingresos,
      tip,
      generated_at: new Date().toISOString(),
      demo: DEMO_MODE,
      ai: HAS_CLAUDE,
    };

    return NextResponse.json(payload);
  } catch (e: any) {
    return NextResponse.json(
      { error: "No pude cargar el dashboard.", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
