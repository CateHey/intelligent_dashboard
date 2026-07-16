import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config";

// Cliente de servidor con service_role. SOLO se usa para:
//  - escribir log y caché (tablas de operación)
//  - invocar exec_read_sql (que corre el SQL de solo lectura)
// NUNCA se expone al navegador.
//
// Se crea de forma perezosa (lazy) para que `next build` no falle al importar el
// módulo sin variables de entorno: el cliente solo se instancia en runtime.
let _admin: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // IMPORTANTE: Next.js parchea el fetch global y cachea las respuestas en
        // su Data Cache. Sin esto, el dashboard sigue mostrando datos viejos aunque
        // la base ya cambió (ej. al recrear v_dashboard). Un dashboard "en vivo"
        // nunca debe leer de caché: siempre va a la base.
        fetch: (input: RequestInfo | URL, init?: RequestInit) =>
          fetch(input, { ...init, cache: "no-store" }),
      },
    });
  }
  return _admin;
}
