import { DASHBOARD_VIEW, QUERY_ROW_LIMIT } from "./config";

// EL PORTERO — valida el SQL que devuelve Claude ANTES de ejecutarlo.
// Capa de software. Debajo está la capa de DB (rol solo-lectura en exec_read_sql).

export type Verdict =
  | { ok: true; sql: string }
  | { ok: false; reason: string };

// Palabras prohibidas (con límites de palabra para no chocar con created_at, updated_at, etc.)
const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "create",
  "grant",
  "revoke",
  "copy",
  "merge",
  "vacuum",
  "call",
  "do",
  "execute",
];

// Patrones prohibidos (substring, no palabra).
const FORBIDDEN_PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /--/, reason: "comentario (--)" },
  { re: /\/\*/, reason: "comentario (/*)" },
  { re: /\*\//, reason: "comentario (*/)" },
  { re: /\bpg_/i, reason: "acceso a catálogo (pg_)" },
  { re: /information_schema/i, reason: "acceso a information_schema" },
  { re: /\binto\b/i, reason: "SELECT INTO" },
];

export function portero(rawSql: string | undefined | null): Verdict {
  if (!rawSql || typeof rawSql !== "string") {
    return { ok: false, reason: "sql vacío" };
  }

  // Limpieza: quita fences de código y espacios; quita un único ';' final.
  let sql = rawSql.trim();
  sql = sql.replace(/^```sql/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  sql = sql.replace(/;\s*$/, "").trim();

  if (sql.length === 0) return { ok: false, reason: "sql vacío" };

  // 1) Debe empezar con SELECT. (No se permite WITH/CTE: complica el allowlist
  //    de tablas. Claude tiene instruido usar subconsultas, no CTEs.)
  if (!/^select\b/i.test(sql)) {
    return { ok: false, reason: "no empieza con SELECT" };
  }

  // 2) Sin múltiples statements (ningún ';' interno tras quitar el final).
  if (sql.includes(";")) {
    return { ok: false, reason: "múltiples statements (;)" };
  }

  // 3) Palabras prohibidas.
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, "i");
    if (re.test(sql)) return { ok: false, reason: `palabra prohibida: ${kw}` };
  }

  // 4) Patrones prohibidos.
  for (const { re, reason } of FORBIDDEN_PATTERNS) {
    if (re.test(sql)) return { ok: false, reason: `patrón prohibido: ${reason}` };
  }

  // 5) Allowlist estricta de tablas: todo FROM/JOIN debe apuntar a v_dashboard.
  const refRe = /\b(from|join)\s+("?[a-zA-Z_][\w".]*"?)/gi;
  let m: RegExpExecArray | null;
  while ((m = refRe.exec(sql)) !== null) {
    const target = m[2].replace(/"/g, "").toLowerCase();
    // permite "public.v_dashboard" y "v_dashboard"
    const bare = target.includes(".") ? target.split(".").pop()! : target;
    if (bare !== DASHBOARD_VIEW) {
      return { ok: false, reason: `tabla no permitida: ${target}` };
    }
  }

  // 6) Inyecta LIMIT si no hay.
  if (!/\blimit\b/i.test(sql)) {
    sql = `${sql} LIMIT ${QUERY_ROW_LIMIT}`;
  }

  return { ok: true, sql };
}
