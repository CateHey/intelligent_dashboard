// Casos trampa del portero (BUILD §8.7). Correr con: npm run test:portero
import { portero } from "../lib/portero";

type Case = { sql: string; expect: "ok" | "reject"; why: string };

const CASES: Case[] = [
  // Permitidos
  {
    sql: "select estado, count(*) as total from v_dashboard group by estado",
    expect: "ok",
    why: "agregación válida",
  },
  {
    sql: "select * from public.v_dashboard limit 10",
    expect: "ok",
    why: "vista con schema explícito",
  },
  {
    sql: "select job_id, fecha from v_dashboard where fecha > now() - interval '30 days'",
    expect: "ok",
    why: "filtro temporal",
  },
  {
    sql: "select tecnico from v_dashboard where tecnico in (select tecnico from v_dashboard where estado = 'Completed') limit 5",
    expect: "ok",
    why: "subconsulta sobre la misma vista",
  },

  // Rechazados — escritura / DDL
  { sql: "delete from jobs_data", expect: "reject", why: "DELETE" },
  { sql: "update v_dashboard set monto = 0", expect: "reject", why: "UPDATE" },
  { sql: "drop table jobs_data", expect: "reject", why: "DROP" },
  {
    sql: "select 1 from v_dashboard; drop table jobs_data",
    expect: "reject",
    why: "múltiples statements",
  },

  // Rechazados — fuera del allowlist
  {
    sql: "select * from job_outcomes",
    expect: "reject",
    why: "tabla no permitida",
  },
  {
    sql: "select * from v_dashboard join staff_data s on true",
    expect: "reject",
    why: "join a tabla no permitida",
  },
  {
    sql: "select * from information_schema.tables",
    expect: "reject",
    why: "information_schema",
  },
  { sql: "select * from pg_catalog.pg_tables", expect: "reject", why: "pg_" },

  // Rechazados — evasión
  {
    sql: "select * from v_dashboard -- ocultar algo",
    expect: "reject",
    why: "comentario --",
  },
  {
    sql: "select /* x */ * from v_dashboard",
    expect: "reject",
    why: "comentario /* */",
  },
  {
    sql: "with x as (select 1) select * from x",
    expect: "reject",
    why: "CTE no permitido",
  },

  // Falsos positivos que NO deben rechazarse
  {
    sql: "select job_id, fecha as created_at from v_dashboard limit 5",
    expect: "ok",
    why: "'created_at' no debe disparar CREATE",
  },
];

let pass = 0;
let fail = 0;

for (const c of CASES) {
  const v = portero(c.sql);
  const got = v.ok ? "ok" : "reject";
  const good = got === c.expect;
  if (good) pass++;
  else fail++;
  const mark = good ? "PASS" : "FAIL";
  const detail = v.ok ? "" : `  (motivo: ${v.reason})`;
  console.log(`${mark}  [${c.expect.padEnd(6)}] ${c.why}${detail}`);
  if (!good) console.log(`      sql: ${c.sql}`);
}

// El LIMIT debe inyectarse cuando falta.
const inj = portero("select * from v_dashboard");
const hasLimit = inj.ok && /limit 500$/i.test(inj.sql);
console.log(`${hasLimit ? "PASS" : "FAIL"}  [inject] LIMIT 500 inyectado si falta`);
hasLimit ? pass++ : fail++;

console.log(`\n${pass} pasaron, ${fail} fallaron`);
process.exit(fail === 0 ? 0 : 1);
