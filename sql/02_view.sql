-- ─────────────────────────────────────────────────────────────
-- 02_view.sql — v_dashboard: la ÚNICA superficie que el portero permite.
--
-- Columnas VERIFICADAS contra el resultado real de sql/01_discovery.sql (2026-07-10).
-- Diferencias encontradas y corregidas: jobs_data usa total_invoice_amount (no
-- invoice_amount) y no tiene created_at (la fecha del job es "date").
--
-- Diseño: una fila por JOB, con su ÚLTIMO outcome (evita doble conteo cuando
-- un job tiene varios outcomes). La app solo conoce las columnas de salida:
--   job_id, job_uuid, estado, cliente, ciudad, tecnico,
--   monto, monto_extra, resultado, fecha_regreso, fecha
-- ─────────────────────────────────────────────────────────────

create or replace view v_dashboard as
with latest_outcome as (
  select distinct on (o.job_uuid)
    o.job_uuid,
    o.outcome,
    o.staff_uuid,
    o.reschedule_date         as reschedule_date,       -- confirmado con 01_discovery
    o.variations_total_cost   as variations_total_cost, -- confirmado con 01_discovery
    o.created_at
  from job_outcomes o
  order by o.job_uuid, o.created_at desc
)
select
  j.generated_job_id                                 as job_id,        -- confirmado con 01_discovery
  j.uuid                                             as job_uuid,
  j.status                                           as estado,
  c.name                                            as cliente,
  j.geo_city                                        as ciudad,        -- confirmado con 01_discovery
  coalesce(nullif(trim(s.full_name), ''),
           nullif(trim(concat_ws(' ', s.first, s.last)), '')) as tecnico,
  coalesce(j.total_invoice_amount, 0)               as monto,         -- jobs_data no tiene invoice_amount
  coalesce(lo.variations_total_cost, 0)             as monto_extra,
  lo.outcome                                        as resultado,
  lo.reschedule_date                                as fecha_regreso,
  coalesce(lo.created_at, j.date)                   as fecha          -- jobs_data no tiene created_at; "date" es la fecha del job
from jobs_data j
left join latest_outcome lo on lo.job_uuid = j.uuid
left join companies_data c  on c.uuid = j.company_uuid
left join staff_data     s  on s.uuid = lo.staff_uuid;
-- SIN filtro de tenant: jobs_data.tenant_id está TODO en NULL (base mono-tenant, 1908 jobs de Inti).
-- Cuando se meta multi-tenant, el filtro vuelve por RLS, no acá.
