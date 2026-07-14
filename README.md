# Dashboard BI conversacional — Inti / Jim's Fencing

Dashboard web en tiempo real (Next.js + Supabase + Claude) que muestra el estado del
negocio y permite **preguntar en lenguaje natural**. Claude genera SQL, un **PORTERO**
lo valida, y un **rol de solo-lectura** en la base garantiza que nunca se escriba nada.

Implementa el `BUILD_dashboard_completo.md` (Nivel C: SQL libre + portero robusto).

---

## Arquitectura (resumen)

```
Navegador (Next.js / recharts)
   │  /api/dashboard (sin IA)        │  /api/ask (con IA)
   ▼                                 ▼
Backend BFF (Next.js Route Handlers)
   normaliza → caché → Claude(traduce) → PORTERO → ejecuta → caché → tip → log
   │
   ▼  exec_read_sql(query)   ← corre el SQL con rol dashboard_readonly
Supabase (Postgres)
   v_dashboard (única superficie)  +  dashboard_query_log / _cache
```

Tres capas de seguridad sobre el SQL que genera Claude:
1. **Portero** (`lib/portero.ts`): solo `SELECT`, solo `v_dashboard`, sin comentarios ni
   múltiples statements, inyecta `LIMIT`.
2. **`exec_read_sql`** (función `SECURITY DEFINER`): re-valida y aplica timeout de 5s.
3. **Rol `dashboard_readonly`**: dueño de la función, solo tiene `SELECT` sobre
   `v_dashboard`. Físicamente no puede escribir ni leer otras tablas.

---

## Demo local (sin Supabase, sin API key)

```bash
npm install
npm run dev      # http://localhost:3000
```

Sin variables de entorno la app arranca sola en **modo demo**:
- **Datos:** Postgres **real** embebido en el proceso (PGlite/WASM) con **220 jobs
  sembrados** (determinísticos) en `v_dashboard`. El portero y el SQL se ejecutan de
  verdad — solo cambia dónde viven los datos.
- **Chat:** sin `ANTHROPIC_API_KEY` usa un **traductor local** por palabras clave y un
  analista que **calcula** sobre las filas reales (nunca inventa números). Un banner
  ámbar lo aclara en pantalla y el badge del tip dice `LOCAL` en vez de `IA`.
- Si cargás `ANTHROPIC_API_KEY` en `.env.local`, el chat pasa a usar **Claude real**
  (SQL libre + portero) sin tocar nada más.

Probá en el chat: *“jobs por técnico”*, *“ingresos por mes”*, *“incidentes”*,
*“trabajos incompletos”*, *“jobs por ciudad este mes”*.

### Probar la seguridad (casos trampa)
```bash
npm run test:portero
```
Verifica que el portero rechace `DELETE`, `DROP`, múltiples statements, tablas fuera del
allowlist, `pg_`, `information_schema`, comentarios y CTEs — y que **no** tenga falsos
positivos (ej. `created_at` no dispara la regla de `CREATE`).

---

## Puesta en marcha (producción, con Supabase)

### 1. Base de datos (Supabase, SQL editor — en orden)
1. `sql/01_discovery.sql` — **verificá los nombres de columnas reales** y ajustá la vista.
2. `sql/02_view.sql` — crea `v_dashboard` (revisá las líneas marcadas `-- AJUSTAR`).
3. `sql/03_tables.sql` — crea `dashboard_query_log` y `dashboard_query_cache`.
4. `sql/04_role_exec.sql` — crea el rol de solo-lectura y `exec_read_sql`.

Probá: `select exec_read_sql('select estado, count(*) from v_dashboard group by estado');`

### 2. Variables de entorno
```bash
cp .env.example .env.local
# completá SUPABASE_SERVICE_ROLE_KEY y ANTHROPIC_API_KEY
```

### 3. Correr local
```bash
npm install
npm run dev      # http://localhost:3000
```

### 4. Deploy (Vercel)

1. Importá el repo en Vercel.
2. **Settings → Environment Variables** (el `.env.local` NO se sube, está gitignoreado):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`,
   `ANTHROPIC_MODEL`, `TENANT_ID`, `RATE_LIMIT_PER_MIN`.
3. `git push` → deploy automático. Cada rama da un *preview*.

**Región:** poné la función en la región de tu proyecto Supabase (Settings → Functions).
Si Supabase está en Sydney (`ap-southeast-2`) y Vercel queda en el default de EE.UU.,
cada consulta cruza el Pacífico y suma ~200 ms.

**Cosas ya resueltas para Vercel:**
- `maxDuration = 30` en ambas rutas (el default de 10s no alcanza para 2 llamadas a Claude).
- **No hay problema de connection pooling**: se habla con Supabase por PostgREST (HTTP),
  no por el driver de Postgres.
- **El modo demo NO se auto-activa en producción.** Si falta una variable, la app
  devuelve un 500 con el nombre de la variable faltante en vez de servir datos falsos.
- El rate-limit cuenta contra la tabla de log, así que funciona entre instancias serverless.

**Peso muerto:** `@electric-sql/pglite` (~25 MB) viaja al bundle aunque en producción no
se use. Está muy por debajo del límite de 250 MB. Si molesta, movelo a `devDependencies`
(rompería un deploy con `DEMO_MODE=1`).

---

## Flujo de una pregunta (`/api/ask`)
1. Rate-limit por tenant (cuenta el log del último minuto).
2. Normaliza la pregunta → busca en `dashboard_query_cache`.
   - HIT → usa `{sql, chart, title}` (salta Claude).
   - MISS → Claude traduce a `{sql, chart, title}` o pide aclaración.
3. **Portero** valida el SQL. Si rechaza → log + error amable.
4. Ejecuta vía `exec_read_sql` (rol solo-lectura).
5. Si fue MISS, guarda en caché (sql/chart/title, **no** los datos).
6. Claude genera el **tip** sobre los datos REALES traídos.
7. Log de auditoría → responde `{ data, chart, title, tip, sql_shown }`.

La **memoria es de sesión**: el front guarda los últimos 8 turnos y los reenvía; al
recargar se borra.

---

## Notas / decisiones
- **Tiempo real:** por ahora *polling* cada 30s + reloj de Perth (simple y robusto).
  Supabase Realtime se puede enchufar luego (requiere RLS para producción).
- **Modelo:** `claude-sonnet-4-6` por defecto (buen balance). Para abaratar, poné
  `ANTHROPIC_MODEL=claude-haiku-4-5-20251001`.
- **El tip nunca inventa números:** se genera *después* de traer los datos, comentando
  solo las filas reales.
- **Columnas de `v_dashboard`:** la app solo conoce las columnas de SALIDA de la vista
  (`job_id, estado, cliente, ciudad, tecnico, monto, monto_extra, resultado,
  fecha_regreso, fecha`). Si el esquema base difiere, se ajusta **solo la vista**.

## Pendiente (fase seguridad, ya encaja sin reescribir)
Login (Supabase Auth) + tenant en el JWT, RLS por tenant (quitar el `WHERE` de la vista),
multi-tenant, memoria persistente. Documentado en el BUILD.
