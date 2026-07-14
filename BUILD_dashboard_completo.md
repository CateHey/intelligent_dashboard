# BUILD MAESTRO — Dashboard BI conversacional (versión completa, sin capa de seguridad aún)
### Para Claude Code. Bien armado desde el inicio, a un paso de lo vendible.

> ALCANCE CONFIRMADO con la product owner:
> - Memoria: SOLO de sesión (se borra al cerrar). Sin tabla de memoria persistente.
> - Preguntas: NIVEL C completo — Claude genera SQL libre, validado por un PORTERO robusto.
> - Incluye: dashboard + chat + memoria sesión + AUDITORÍA + CACHÉ + RATE-LIMIT.
> - NO incluye AÚN: login, RLS, multi-tenant. (Inti es el único tenant, fijo. Seguridad = fase próxima.)
> - Calidad: NO es una "demo simple". Es la base real del producto; lo que falta para vender es
>   solo la capa de seguridad/acceso + onboarding, no rehacer esto.

---

## 0. PRINCIPIOS (no se rompen)
- Claude genera el SQL pero NUNCA toca la base directo: pasa por el PORTERO + rol de solo-lectura.
- Claude NUNCA inventa números: todo dato viene de la BD. El tip comenta datos reales.
- Claude NUNCA genera HTML/JSX: la UI está construida; Claude devuelve datos + qué gráfico + tip.
- Se MUESTRA el SQL usado (transparencia "confiar pero verificar").
- Ambiguo → pedir aclaración, no adivinar. Sin datos → "no hay datos", no inventar.
- La arquitectura ya es la de producto; la seguridad se ENCHUFA después sin reescribir.

---

## 1. BASE DE DATOS (Supabase)

### 1.1 Vista de lectura
```sql
CREATE OR REPLACE VIEW v_dashboard AS
SELECT
  j.generated_job_id              AS job_id,
  j.status                        AS estado,
  c.name                          AS cliente,
  j.geo_city                      AS ciudad,
  COALESCE(o.variations_total_cost,0) AS monto_extra,
  o.outcome                       AS resultado,
  o.reschedule_date               AS fecha_regreso,
  j.uuid                          AS job_uuid,
  o.created_at                    AS fecha
FROM jobs_data j
LEFT JOIN companies_data c ON c.uuid = j.company_uuid
LEFT JOIN job_outcomes  o ON o.job_uuid = j.uuid
WHERE j.tenant_id = 'ddec3ab2-ec58-46c8-912c-1d1cd00cae86';  -- Inti (se quita al meter RLS)
```
> Ajustar nombres a las columnas reales del FIELD_DICTIONARY. La vista es la ÚNICA superficie que
> el portero permite consultar (allowlist = ['v_dashboard']).

### 1.2 Tablas de operación (estas SÍ se crean — auditoría y caché)
```sql
-- Auditoría: cada pregunta y su SQL, para soporte y para afinar el prompt
CREATE TABLE dashboard_query_log (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid,
  question      text,
  sql_generated text,
  approved      boolean,
  reject_reason text,
  row_count     int,
  latency_ms    int,
  created_at    timestamptz DEFAULT now()
);

-- Caché: pregunta normalizada -> sql+chart (NO los datos, que cambian)
CREATE TABLE dashboard_query_cache (
  id            bigserial PRIMARY KEY,
  tenant_id     uuid,
  question_norm text,          -- pregunta normalizada (minúsculas, sin signos)
  sql_generated text,
  chart         text,
  title         text,
  created_at    timestamptz DEFAULT now(),
  UNIQUE(tenant_id, question_norm)
);
```
> Memoria de conversación NO va en tabla (es de sesión, vive en el front). Ver sección 4.

### 1.3 Rol de BD
- Un rol/clave de SOLO LECTURA sobre v_dashboard. Sin RLS por ahora (la vista ya filtra a Inti).
- Cuando se meta seguridad: quitar el WHERE de la vista + activar RLS + rol por tenant.

---

## 2. STACK
- Next.js (App Router) en Vercel. Front + API routes en el mismo proyecto.
- Supabase JS (rol lectura) para datos; service role SOLO en server para log/cache.
- Claude API server-side (key nunca en el front).
- recharts para gráficos. Tailwind/CSS con los tokens del BRIEF_dashboard_React_para_claude_code.md.
- Caché y rate-limit: tablas Supabase (arriba) o Vercel KV.

---

## 3. /api/ask — EL CEREBRO (flujo completo)

```
recibe { question, history }            (history = turnos de la sesión, del front)
  │
  1. normaliza la pregunta → busca en dashboard_query_cache (tenant+question_norm)
  │     ├─ HIT  → usa {sql, chart, title} cacheado (salta Claude)
  │     └─ MISS → llama a Claude (pregunta + history + esquema v_dashboard) → {sql,chart,title,tip,needs_clarification}
  │
  2. si needs_clarification → responde pidiendo aclaración (no ejecuta)
  │
  3. PORTERO valida el sql (sección 5). Si rechaza → log(approved=false) + responde error amable
  │
  4. ejecuta sql con rol solo-lectura → filas
  │
  5. guarda en dashboard_query_cache (si fue MISS y aprobado)
  │
  6. log en dashboard_query_log (pregunta, sql, approved, row_count, latency)
  │
  7. responde { ok, data, chart, title, tip, sql_shown }
```
Rate-limit: antes del paso 1, chequear N preguntas/min por tenant; si excede → 429 amable.

### Contrato
Request: `{ "question": "...", "history": [{"q":"...","sql":"..."}] }`
Claude responde SOLO: `{ "sql","chart","title","tip","needs_clarification","clarification" }`
Response: `{ "ok":true, "data":[...], "chart","title","tip","sql_shown" }`
  o `{ "ok":false, "error":"Solo puedo consultar datos." }`

---

## 4. MEMORIA (de sesión, en el front)
- El front guarda en estado (useState/useReducer) los últimos ~8 turnos {pregunta, sql, título}.
- En cada nueva pregunta, manda ese `history` a /api/ask, que lo pasa a Claude para contexto.
- Permite seguimiento: "jobs por técnico" → "¿y solo junio?" → Claude entiende el hilo.
- Al recargar/cerrar: se borra. (Persistente = fase futura, necesitaría tabla.)

---

## 5. EL PORTERO (robusto — clave del Nivel C)
Valida el SQL que devuelve Claude ANTES de ejecutar. Rechaza si:
- No empieza con SELECT (tras trim, case-insensitive).
- Contiene cualquiera de: INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, GRANT, REVOKE,
  COPY, ; (múltiples statements), -- , /*  */ (comentarios), pg_, information_schema.
- Referencia algo que NO sea v_dashboard (allowlist estricta).
- No tiene LIMIT → se le inyecta LIMIT 500.
- Supera un timeout de ejecución (ej. 5s).
Capa extra: el rol de BD es solo-lectura → aunque algo se filtre, la BD rechaza escrituras.
Todo rechazo se loguea (para detectar intentos y afinar).

---

## 6. FRONTEND (calidad producto, no demo)
Usar el diseño de BRIEF_dashboard_React_para_claude_code.md (paleta acero/seguridad, tokens, firma).
Componentes:
- <Header/> marca + estado en vivo + reloj Perth.
- <KpiRow/> con <KpiCard/> (skeleton mientras carga).
- <ChartPanel/> reutilizable: recibe {tipo, datos, título} y renderiza recharts. El chat cambia sus
  PROPS, no genera componentes.
- <TipsPanel/> tips de IA (badge "Generado por IA").
- <ChatPanel/> log + chips de sugerencias + input + indicador "pensando..." + muestra el SQL usado.
Estados: skeletons en carga, vacío ("sin datos para eso"), error (mensaje claro, nunca pantalla blanca).
Modo 0 (base): KPIs + dona estado + barras técnico + línea ingresos + tips, cargados al abrir.
Modo 2 (chat): el usuario pregunta → /api/ask → se actualizan props de los paneles.

---

## 7. QUÉ QUEDA PARA LA FASE SEGURIDAD (no en este build, pero ya encaja)
- Login (Supabase Auth) + tenant en el JWT.
- RLS por tenant (quitar el WHERE hardcodeado de la vista).
- Multi-tenant (varios clientes); el tenant sale del token, no del request.
- Memoria persistente (tabla) si se quiere recordar entre sesiones.
- Prueba de aislamiento entre 2 tenants (obligatoria antes de vender a terceros).
> Documentado en ESPEC_tecnica_capas_dashboard.md y POC_dashboard_Inti_tenant.md.
> Importante: este build se diseña para que enchufar la seguridad NO obligue a reescribir el core.

---

## 8. ORDEN DE IMPLEMENTACIÓN
1. Supabase: v_dashboard + tablas query_log y query_cache + rol lectura.
2. Next.js: layout + Modo 0 con datos reales (diseño del brief).
3. /api/ask: Claude + portero + ejecución + caché + log + rate-limit (flujo sección 3).
4. Chat (Modo 2) con memoria de sesión (history) + estados de carga + mostrar SQL.
5. Pulido visual (skeletons, transiciones, vacío/error).
6. Deploy en Vercel.
7. Probar Nivel C: preguntas libres reales + casos trampa (borrar→rechaza, otra tabla→rechaza,
   ambiguo→aclara, sin datos→"no hay").

## 9. DATOS DEL ENTORNO
- Supabase proyecto qvtwcpnbcfjwylpawbkb. Tenant Inti: ddec3ab2-ec58-46c8-912c-1d1cd00cae86.
- Tablas fuente: jobs_data, job_outcomes, companies_data, staff_data, job_activities_data.
- Validar nombres de columnas contra FIELD_DICTIONARY.md (no inventar).
- Proyecto SEPARADO del bot de WhatsApp (solo comparten la base; el dashboard LEE).
