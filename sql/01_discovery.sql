-- ─────────────────────────────────────────────────────────────
-- 01_discovery.sql — VERIFICAR columnas reales ANTES de crear la vista.
-- Corré esto en el SQL editor de Supabase y compará con lo que asume
-- sql/02_view.sql. Si algún nombre difiere, ajustá SOLO la vista.
-- (La app depende de las columnas de SALIDA de v_dashboard, no de las base.)
-- ─────────────────────────────────────────────────────────────

select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('jobs_data', 'job_outcomes', 'companies_data', 'staff_data')
order by table_name, ordinal_position;

-- Muestras rápidas para entender los datos:
-- select * from jobs_data    limit 5;
-- select * from job_outcomes limit 5;
-- select distinct status  from jobs_data;
-- select distinct outcome from job_outcomes;
