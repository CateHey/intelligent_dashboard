-- ─────────────────────────────────────────────────────────────
-- 04_role_exec.sql — La función-puerta anti-tonterías (versión mínima).
--
-- El SQL que genera Claude NUNCA se ejecuta directo: pasa por exec_read_sql,
-- que (a) exige que empiece con SELECT y (b) lo envuelve como subconsulta
-- `select ... from (TU_QUERY) t`. Ese envoltorio hace IMPOSIBLE escribir:
-- un INSERT/UPDATE/DELETE ahí adentro es error de sintaxis en Postgres.
--
-- No necesita permisos de admin ni roles. Idempotente.
-- IMPORTANTE en Supabase: correr SOLO este bloque (sin los tests de abajo en la
-- misma corrida). Si el editor corta con "Connection terminated", dar Run otra vez.
-- ─────────────────────────────────────────────────────────────

create or replace function exec_read_sql(query text)
returns jsonb
language plpgsql
set statement_timeout = 5000        -- timeout duro de 5s
as $$
declare
  result jsonb;
begin
  if query !~* '^\s*select' then
    raise exception 'Solo se permiten consultas SELECT';
  end if;

  execute format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s) as t', query)
    into result;

  return result;
end
$$;

-- ─────────────────────────────────────────────────────────────
-- Prueba (en OTRA corrida, de a una línea):
--   select exec_read_sql('select estado, count(*) from v_dashboard group by estado');  -- trae datos
--   select exec_read_sql('delete from jobs_data');  -- ERROR: Solo se permiten consultas SELECT
-- ─────────────────────────────────────────────────────────────
