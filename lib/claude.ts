import Anthropic from "@anthropic-ai/sdk";
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  HAS_CLAUDE,
  QUERY_ROW_LIMIT,
} from "./config";
import { localTip, localTranslate } from "./localAi";
import type { ChartType, HistoryTurn, Row, Translation } from "./types";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
  return _client;
}

// Descripción del esquema que ve Claude. SOLO existe v_dashboard.
const SCHEMA_DOC = `
Solo existe UNA vista consultable: v_dashboard. Columnas:
- job_id (text): número de trabajo legible, ej "1427".
- job_uuid (uuid): id interno.
- estado (text): estado del job. Valores típicos: 'Work Order' (en curso/incompleto), 'Completed', 'Quote', 'Unsuccessful'.
- cliente (text): nombre de la empresa/cliente.
- ciudad (text): ciudad del job.
- tecnico (text): nombre del técnico que reportó el último resultado (puede ser NULL).
- monto (numeric): monto facturado del job.
- monto_extra (numeric): costo de variaciones/adicionales.
- resultado (text): outcome reportado por el bot. Valores: 'completed', 'reschedule_clear', 'reschedule_unclear', 'issue_on_site'. (Los incidentes son 'issue_on_site'.)
- fecha_regreso (date): fecha de reprogramación si la hubo (puede ser NULL).
- fecha (timestamptz): fecha del job/evento.
`.trim();

function today(): string {
  // Fecha actual en zona de Perth (el negocio opera allá).
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Perth",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

const TRANSLATE_SYSTEM = () =>
  `
Sos el traductor de un dashboard de BI para Jim's Fencing. Convertís una pregunta en
lenguaje natural a UNA consulta SQL de PostgreSQL de SOLO LECTURA sobre la vista v_dashboard.

${SCHEMA_DOC}

Fecha de hoy (Perth): ${today()}. Usala para "este mes", "junio", "última semana", etc.

REGLAS DURAS:
- SOLO SELECT. Nunca INSERT/UPDATE/DELETE/DDL.
- SOLO la vista v_dashboard. Nada de otras tablas, ni pg_, ni information_schema.
- NO uses CTE (WITH). Usá subconsultas si hace falta.
- NO uses comentarios SQL (-- o /* */). NO uses punto y coma.
- Incluí siempre un LIMIT razonable (máx ${QUERY_ROW_LIMIT}).
- Para agregaciones usá GROUP BY y alias claros en español (ej. total, mes, tecnico).
- Usá el CONTEXTO de la conversación: si algo ya se aclaró (ej. que "Paulo" es un
  técnico, o el período), NO vuelvas a preguntarlo; resolvé con esa info.
- Pedí aclaración (needs_clarification=true) SOLO si es imprescindible y no se puede
  inferir. Ante un nombre de persona, asumí que es un técnico (columna "tecnico")
  salvo que digan "cliente". Preferí responder con datos antes que preguntar.
- Para filtrar por un nombre parcial usá ILIKE, ej. tecnico ILIKE '%Paulo%'.
- Elegí "chart": 'bar' (comparar categorías), 'line' (evolución temporal),
  'pie' (proporción de un total), o 'table' (detalle/listado).

Respondé EXCLUSIVAMENTE un objeto JSON válido, sin texto extra, con esta forma:
{"needs_clarification": boolean, "clarification": string|null, "sql": string|null, "chart": "bar|line|pie|table", "title": string}
`.trim();

function extractJson(text: string): any {
  let t = text.trim();
  t = t.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  // Toma el primer bloque {...} por si vino con texto alrededor.
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    t = t.slice(start, end + 1);
  }
  return JSON.parse(t);
}

export async function translateToSql(
  question: string,
  history: HistoryTurn[] = []
): Promise<Translation> {
  // Sin API key (demo offline): traductor local por palabras clave.
  if (!HAS_CLAUDE) return localTranslate(question);

  // La conversación previa se pasa como mensajes reales, para que Claude
  // resuelva referencias ya aclaradas ("es el técnico", "solo junio", etc.).
  const priorMessages = history
    .slice(-8)
    .map((h) => ({ role: h.role, content: h.content }));

  const resp = await client().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: TRANSLATE_SYSTEM(),
    messages: [...priorMessages, { role: "user", content: `Pregunta: ${question}` }],
  });

  const text = resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");

  let parsed: any;
  try {
    parsed = extractJson(text);
  } catch {
    return {
      needs_clarification: true,
      clarification: "No entendí bien la pregunta, ¿podés reformularla?",
    };
  }

  const chart: ChartType = ["bar", "line", "pie", "table"].includes(parsed.chart)
    ? parsed.chart
    : "table";

  return {
    needs_clarification: Boolean(parsed.needs_clarification),
    clarification: parsed.clarification || undefined,
    sql: parsed.sql || undefined,
    chart,
    title: parsed.title || "Resultado",
  };
}

const TIP_SYSTEM = `
Sos un analista de negocio. Te paso datos REALES ya consultados de un dashboard de Jim's Fencing.
Escribí UN tip corto (1-2 frases, en español) que ayude a Susana/admin a decidir.
REGLAS:
- Comentá SOLO los datos provistos. NUNCA inventes números que no estén en los datos.
- Si los datos no dan para una conclusión útil, decilo en una frase.
- Tono claro y directo, sin jerga. No repitas la tabla entera.
Respondé solo el texto del tip, sin comillas ni prefijos.
`.trim();

export async function generateTip(question: string, rows: Row[]): Promise<string> {
  // Sin API key (demo offline): analista local que CALCULA sobre las filas reales.
  if (!HAS_CLAUDE) return localTip(question, rows);

  // Limita el payload para no gastar tokens de más.
  const sample = rows.slice(0, 60);
  const resp = await client().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 300,
    system: TIP_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Pregunta del usuario: ${question}\n\nDatos (JSON):\n${JSON.stringify(
          sample
        )}`,
      },
    ],
  });

  return resp.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}
