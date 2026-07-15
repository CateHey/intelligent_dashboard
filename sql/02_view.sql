-- ─────────────────────────────────────────────────────────────
-- 02_view.sql — v_dashboard: la ÚNICA superficie que el portero permite.
--
-- Columnas VERIFICADAS contra sql/01_discovery.sql. jobs_data usa
-- total_invoice_amount (no invoice_amount) y no tiene created_at (usa "date").
--
-- TÉCNICO: sale de job_activities_data (la asignación REAL de staff a cada job),
-- NO de job_outcomes. Motivo: job_outcomes solo lo escribe el bot de WhatsApp,
-- así que apenas ~19 jobs tenían técnico. Vía job_activities_data hay ~1259.
-- Se toma la última actividad con staff, priorizando la 'recorded' (la que
-- efectivamente se hizo) sobre la 'scheduled'.
--
-- Salida (lo único que conoce la app):
--   job_id, job_uuid, estado, cliente, ciudad, tecnico,
--   monto, monto_extra, resultado, fecha_regreso, fecha
-- ─────────────────────────────────────────────────────────────

create or replace view v_dashboard as
with latest_outcome as (
  -- Último outcome del bot por job (para resultado / variaciones / reprogramación).
  select distinct on (o.job_uuid)
    o.job_uuid,
    o.outcome,
    o.reschedule_date,
    o.variations_total_cost,
    o.created_at
  from job_outcomes o
  order by o.job_uuid, o.created_at desc
),
latest_activity as (
  -- Staff asignado a cada job: la última actividad con staff, priorizando la
  -- 'recorded' (trabajo efectivamente hecho) sobre la 'scheduled' (planificada).
  select distinct on (a.job_uuid)
    a.job_uuid,
    a.staff_uuid
  from job_activities_data a
  where a.staff_uuid is not null
  order by a.job_uuid, (a.activity_type = 'recorded') desc, a.start_date desc nulls last
)
select
  j.generated_job_id                                 as job_id,
  j.uuid                                             as job_uuid,
  j.status                                           as estado,
  c.name                                             as cliente,
  j.geo_city                                         as ciudad,
  coalesce(nullif(trim(s.full_name), ''),
           nullif(trim(concat_ws(' ', s.first, s.last)), '')) as tecnico,
  coalesce(j.total_invoice_amount, 0)                as monto,
  coalesce(lo.variations_total_cost, 0)              as monto_extra,
  lo.outcome                                         as resultado,
  lo.reschedule_date                                 as fecha_regreso,
  coalesce(lo.created_at, j.date)                    as fecha
from jobs_data j
left join latest_outcome  lo on lo.job_uuid = j.uuid
left join latest_activity la on la.job_uuid = j.uuid
left join companies_data  c  on c.uuid = j.company_uuid
left join staff_data      s  on s.uuid = la.staff_uuid;
-- Mono-tenant: jobs_data.tenant_id está TODO en NULL, por eso no se filtra por tenant.
