import { NextResponse } from "next/server";
import { normalize } from "@/lib/normalize";
import { portero } from "@/lib/portero";
import { translateToSql, generateTip } from "@/lib/claude";
import { getCache, setCache } from "@/lib/cache";
import { isRateLimited } from "@/lib/ratelimit";
import { logQuery } from "@/lib/log";
import { runReadSql } from "@/lib/exec";
import { HAS_CLAUDE, assertConfigured } from "@/lib/config";
import type { AskResponse, ChartType, HistoryTurn } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Dos llamadas a Claude + SQL: el default de 10s de Vercel se queda corto.
export const maxDuration = 30;

function reply(body: AskResponse, status = 200) {
  return NextResponse.json(body, { status });
}

// POST /api/ask  — { question, history } -> { ok, data, chart, title, tip, sql_shown }
export async function POST(req: Request) {
  const t0 = Date.now();

  try {
    assertConfigured();
  } catch (e: any) {
    return reply({ ok: false, error: String(e?.message || e) }, 500);
  }

  let question = "";
  let history: HistoryTurn[] = [];
  try {
    const body = await req.json();
    question = typeof body?.question === "string" ? body.question.trim() : "";
    history = Array.isArray(body?.history) ? body.history : [];
  } catch {
    return reply({ ok: false, error: "Pedido inválido." }, 400);
  }

  if (!question) return reply({ ok: false, error: "La pregunta está vacía." }, 400);

  // Rate-limit (antes de gastar Claude).
  if (await isRateLimited()) {
    return reply(
      { ok: false, error: "Demasiadas preguntas seguidas. Esperá un momento." },
      429
    );
  }

  const qnorm = normalize(question);

  // 1) Caché (sql + chart + title; los datos NO se cachean).
  let sql: string | undefined;
  let chart: ChartType = "table";
  let title = "Resultado";
  let wasMiss = false;

  const cached = await getCache(qnorm);
  if (cached) {
    sql = cached.sql_generated;
    chart = cached.chart;
    title = cached.title;
  } else {
    wasMiss = true;
    // 2) Claude traduce NL -> SQL. Si Claude falla (modelo inválido, red, cuota),
    //    devolvemos un error amable en vez de un 500 pelado.
    let t;
    try {
      t = await translateToSql(question, history);
    } catch (e: any) {
      await logQuery({
        question,
        sql: null,
        approved: false,
        reject_reason: "claude_error: " + String(e?.message || e),
        row_count: 0,
        latency_ms: Date.now() - t0,
      });
      return reply({
        ok: false,
        error: "No pude procesar la pregunta ahora mismo. Probá de nuevo en un momento.",
      });
    }
    if (t.needs_clarification) {
      await logQuery({
        question,
        sql: null,
        approved: false,
        reject_reason: "needs_clarification",
        row_count: 0,
        latency_ms: Date.now() - t0,
      });
      return reply({
        ok: false,
        needs_clarification: true,
        clarification: t.clarification || "¿Podés dar un poco más de detalle?",
      });
    }
    sql = t.sql;
    chart = t.chart || "table";
    title = t.title || "Resultado";
  }

  // 3) PORTERO valida el SQL.
  const verdict = portero(sql);
  if (!verdict.ok) {
    await logQuery({
      question,
      sql: sql || null,
      approved: false,
      reject_reason: verdict.reason,
      row_count: 0,
      latency_ms: Date.now() - t0,
    });
    return reply({
      ok: false,
      error: "Solo puedo consultar datos de lectura. Probá reformular la pregunta.",
    });
  }
  const safeSql = verdict.sql;

  // 4) Ejecuta con rol solo-lectura (dentro de exec_read_sql).
  let rows;
  try {
    rows = await runReadSql(safeSql);
  } catch (e: any) {
    await logQuery({
      question,
      sql: safeSql,
      approved: true,
      reject_reason: "exec_error: " + String(e?.message || e),
      row_count: 0,
      latency_ms: Date.now() - t0,
    });
    return reply({
      ok: false,
      error: "No pude ejecutar esa consulta. Probá reformular la pregunta.",
    });
  }

  // 5) Guarda en caché si fue MISS y aprobado.
  if (wasMiss && safeSql) {
    await setCache(qnorm, safeSql, chart, title);
  }

  // 6) Tip a partir de datos REALES (nunca inventa números).
  let tip = "";
  if (rows.length === 0) {
    tip = "No hay datos para esa consulta.";
  } else {
    try {
      tip = await generateTip(question, rows);
    } catch {
      tip = "";
    }
  }

  // 7) Log de auditoría.
  await logQuery({
    question,
    sql: safeSql,
    approved: true,
    reject_reason: null,
    row_count: rows.length,
    latency_ms: Date.now() - t0,
  });

  return reply({
    ok: true,
    data: rows,
    chart,
    title,
    tip,
    sql_shown: safeSql,
    ai: HAS_CLAUDE,
  });
}
