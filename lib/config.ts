// Configuración central. Lee de variables de entorno (ver .env.example).

function optional(name: string): string {
  return process.env[name] || "";
}

export const SUPABASE_URL = optional("SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = optional("SUPABASE_SERVICE_ROLE_KEY");
export const ANTHROPIC_API_KEY = optional("ANTHROPIC_API_KEY");
export const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
export const TENANT_ID =
  process.env.TENANT_ID || "ddec3ab2-ec58-46c8-912c-1d1cd00cae86";
export const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN || 20);

const IS_PROD = process.env.NODE_ENV === "production";

// ¿Está Supabase configurado por completo? (URL sin key no sirve.)
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

// MODO DEMO: corre contra un Postgres embebido (PGlite) con datos sembrados.
//
// Se activa: (a) explícitamente con DEMO_MODE=1, o
//            (b) automáticamente SOLO en desarrollo cuando falta Supabase.
//
// En producción NUNCA se auto-activa: si faltan credenciales, la app falla
// ruidosamente (ver assertConfigured) en vez de servir datos falsos sin avisar.
export const DEMO_MODE =
  process.env.DEMO_MODE === "1" || (!IS_PROD && !HAS_SUPABASE);

// ¿Hay API key de Claude? Si no, el chat usa un traductor local de respaldo.
export const HAS_CLAUDE = Boolean(ANTHROPIC_API_KEY);

// Falla temprano y claro si la app corre "en serio" sin lo mínimo.
export function assertConfigured(): void {
  if (DEMO_MODE) return;
  const faltan: string[] = [];
  if (!SUPABASE_URL) faltan.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) faltan.push("SUPABASE_SERVICE_ROLE_KEY");
  if (faltan.length > 0) {
    throw new Error(
      `Faltan variables de entorno: ${faltan.join(", ")}. ` +
        `Cargalas en Vercel (Settings → Environment Variables) o poné DEMO_MODE=1.`
    );
  }
}

// La única superficie consultable. El portero rechaza cualquier otra cosa.
export const DASHBOARD_VIEW = "v_dashboard";
export const QUERY_ROW_LIMIT = 500;
export const EXEC_TIMEOUT_MS = 5000;
