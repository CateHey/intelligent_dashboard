// Respaldo LOCAL cuando no hay ANTHROPIC_API_KEY (demo offline).
// No es "IA": es un traductor por palabras clave y un analista que CALCULA
// sobre las filas reales. Nunca inventa números — igual que la regla dura de Claude.

import { normalize } from "./normalize";
import type { Row, Translation } from "./types";

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

export function localTranslate(question: string): Translation {
  const q = normalize(question);

  // Filtro temporal opcional.
  const conds: string[] = [];
  if (has(q, "este mes", "del mes", "mes actual")) {
    conds.push("date_trunc('month', fecha) = date_trunc('month', now())");
  }
  const and = (extra?: string) => {
    const all = extra ? [...conds, extra] : conds;
    return all.length ? `where ${all.join(" and ")}` : "";
  };

  // Incidentes / problemas en sitio
  if (has(q, "incidente", "issue", "problema", "roto", "rompio", "urgente")) {
    return {
      needs_clarification: false,
      sql: `select job_id, cliente, tecnico, ciudad, resultado, fecha from v_dashboard ${and(
        "resultado = 'issue_on_site'"
      )} order by fecha desc limit 50`,
      chart: "table",
      title: "Incidentes en sitio",
    };
  }

  // Trabajos incompletos / en curso
  if (has(q, "incompleto", "work order", "en curso", "pendiente", "sin terminar")) {
    return {
      needs_clarification: false,
      sql: `select job_id, cliente, tecnico, ciudad, fecha_regreso, fecha from v_dashboard ${and(
        "estado = 'Work Order'"
      )} order by fecha desc limit 50`,
      chart: "table",
      title: "Trabajos en curso",
    };
  }

  // Por técnico
  if (has(q, "tecnico", "tecnicos", "staff", "empleado", "quien")) {
    return {
      needs_clarification: false,
      sql: `select tecnico, count(*)::int as total from v_dashboard ${and(
        "tecnico is not null"
      )} group by tecnico order by total desc limit 12`,
      chart: "bar",
      title: "Jobs por técnico",
    };
  }

  // Ingresos
  if (has(q, "ingreso", "factur", "monto", "plata", "dinero", "revenue")) {
    return {
      needs_clarification: false,
      sql: `select to_char(date_trunc('month', fecha), 'YYYY-MM') as mes, coalesce(sum(monto), 0)::numeric as total from v_dashboard ${and(
        "fecha is not null"
      )} group by date_trunc('month', fecha) order by date_trunc('month', fecha) limit 12`,
      chart: "line",
      title: "Ingresos por mes",
    };
  }

  // Por ciudad
  if (has(q, "ciudad", "zona", "suburb", "donde")) {
    return {
      needs_clarification: false,
      sql: `select ciudad, count(*)::int as total from v_dashboard ${and(
        "ciudad is not null"
      )} group by ciudad order by total desc limit 12`,
      chart: "bar",
      title: "Jobs por ciudad",
    };
  }

  // Por cliente
  if (has(q, "cliente", "empresa", "company")) {
    return {
      needs_clarification: false,
      sql: `select cliente, count(*)::int as total from v_dashboard ${and(
        "cliente is not null"
      )} group by cliente order by total desc limit 10`,
      chart: "bar",
      title: "Jobs por cliente",
    };
  }

  // Por estado (también el caso general "cómo venimos")
  if (has(q, "estado", "status", "resumen", "general", "como venimos")) {
    return {
      needs_clarification: false,
      sql: `select estado, count(*)::int as total from v_dashboard ${and(
        "estado is not null"
      )} group by estado order by total desc limit 12`,
      chart: "pie",
      title: "Jobs por estado",
    };
  }

  return {
    needs_clarification: true,
    clarification:
      "Modo demo sin Claude: probá con “jobs por estado”, “jobs por técnico”, “ingresos por mes”, “incidentes” o “trabajos incompletos”.",
  };
}

// Resumen del día para la carga base. Calculado sobre KPIs y agregados reales.
export function localSummary(
  kpis: { total_jobs: number; completados: number; work_order: number; ingresos_mes: number },
  tecnicos: Row[]
): string {
  if (kpis.total_jobs === 0) return "Todavía no hay jobs cargados.";

  const pctComp = Math.round((kpis.completados / kpis.total_jobs) * 100);
  const money = kpis.ingresos_mes.toLocaleString("es-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });

  let carga = "";
  if (tecnicos.length > 0) {
    const totalAsignado = tecnicos.reduce((a, t) => a + Number(t.total ?? 0), 0);
    const top = tecnicos[0];
    const pctTop = Math.round((Number(top.total ?? 0) / totalAsignado) * 100);
    if (pctTop >= 30) {
      carga = ` ${top.tecnico} concentra ${top.total} jobs (${pctTop}% de la carga asignada) — conviene revisar el reparto.`;
    } else {
      carga = ` ${top.tecnico} lidera con ${top.total} jobs (${pctTop}% de la carga).`;
    }
  }

  return `${kpis.total_jobs} jobs en total: ${kpis.completados} completados (${pctComp}%) y ${kpis.work_order} en curso. Ingresos del mes: ${money}.${carga}`;
}

// Analista local: calcula sobre las filas REALES traídas. Cero invención.
export function localTip(_question: string, rows: Row[]): string {
  if (!rows || rows.length === 0) return "No hay datos para esa consulta.";

  const keys = Object.keys(rows[0]);
  const numKey = keys.find((k) => {
    const v = rows[0][k];
    return v !== null && v !== "" && !isNaN(Number(v));
  });
  const catKey = keys.find((k) => k !== numKey);

  if (!numKey || !catKey || rows.length < 2) {
    return `Se encontraron ${rows.length} fila(s) para esa consulta.`;
  }

  const vals = rows.map((r) => Number(r[numKey] ?? 0));
  const total = vals.reduce((a, b) => a + b, 0);
  if (total <= 0) return `Se encontraron ${rows.length} fila(s) para esa consulta.`;

  let topIdx = 0;
  for (let i = 1; i < vals.length; i++) if (vals[i] > vals[topIdx]) topIdx = i;

  const topName = String(rows[topIdx][catKey] ?? "—");
  const topVal = vals[topIdx];
  const pct = Math.round((topVal / total) * 100);

  const sorted = [...vals].sort((a, b) => b - a);
  const top3 = sorted.slice(0, 3).reduce((a, b) => a + b, 0);
  const pct3 = Math.round((top3 / total) * 100);

  const extra =
    rows.length > 3
      ? ` Los tres primeros concentran el ${pct3}% del total.`
      : "";

  return `“${topName}” encabeza con ${topVal.toLocaleString(
    "es-AU"
  )} de ${total.toLocaleString("es-AU")} (${pct}%).${extra}`;
}
