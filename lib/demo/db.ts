// MODO DEMO — Postgres real, embebido en el proceso (PGlite / WASM).
// Permite correr la demo completa sin Supabase: el portero y el SQL se ejecutan
// de verdad contra Postgres, solo cambia dónde viven los datos.

import { buildSeed } from "./seed";
import type { Row } from "../types";

// Tipo laxo para no acoplarnos a la firma exacta de PGlite.
type Db = {
  exec: (sql: string) => Promise<unknown>;
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

const SCHEMA = `
create table if not exists v_dashboard (
  job_id        text,
  job_uuid      text,
  estado        text,
  cliente       text,
  ciudad        text,
  tecnico       text,
  monto         numeric,
  monto_extra   numeric,
  resultado     text,
  fecha_regreso date,
  fecha         timestamptz
);

create table if not exists dashboard_query_log (
  id            bigserial primary key,
  tenant_id     text,
  question      text,
  sql_generated text,
  approved      boolean,
  reject_reason text,
  row_count     int,
  latency_ms    int,
  created_at    timestamptz default now()
);

create table if not exists dashboard_query_cache (
  id            bigserial primary key,
  tenant_id     text,
  question_norm text,
  sql_generated text,
  chart         text,
  title         text,
  created_at    timestamptz default now(),
  unique (tenant_id, question_norm)
);
`;

let _init: Promise<Db> | null = null;

async function create(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = (await PGlite.create()) as unknown as Db;

  await db.exec(SCHEMA);
  await db.exec(`set statement_timeout = 5000`);

  const rows = buildSeed();
  for (const r of rows) {
    await db.query(
      `insert into v_dashboard
        (job_id, job_uuid, estado, cliente, ciudad, tecnico, monto, monto_extra, resultado, fecha_regreso, fecha)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        r.job_id,
        r.job_uuid,
        r.estado,
        r.cliente,
        r.ciudad,
        r.tecnico,
        r.monto,
        r.monto_extra,
        r.resultado,
        r.fecha_regreso,
        r.fecha,
      ]
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[demo] PGlite listo · ${rows.length} jobs sembrados en v_dashboard`);
  return db;
}

export function getDemoDb(): Promise<Db> {
  if (!_init) _init = create();
  return _init;
}

export async function demoQuery(sql: string, params: unknown[] = []): Promise<Row[]> {
  const db = await getDemoDb();
  const res = await db.query(sql, params);
  return res.rows as Row[];
}
