-- ─────────────────────────────────────────────────────────────
-- 03_tables.sql — Tablas de operación: auditoría y caché.
-- Estas SÍ se escriben (con service_role, solo desde el server).
-- ─────────────────────────────────────────────────────────────

-- Auditoría: cada pregunta, su SQL y el veredicto. Para soporte y afinar prompts.
create table if not exists dashboard_query_log (
  id            bigserial primary key,
  tenant_id     uuid,
  question      text,
  sql_generated text,
  approved      boolean,
  reject_reason text,
  row_count     int,
  latency_ms    int,
  created_at    timestamptz default now()
);

-- Índice para el rate-limit (conteo por tenant en el último minuto).
create index if not exists idx_query_log_tenant_time
  on dashboard_query_log (tenant_id, created_at desc);

-- Caché: pregunta normalizada -> sql + chart + title (NO los datos, que cambian).
create table if not exists dashboard_query_cache (
  id            bigserial primary key,
  tenant_id     uuid,
  question_norm text,
  sql_generated text,
  chart         text,
  title         text,
  created_at    timestamptz default now(),
  unique (tenant_id, question_norm)
);
