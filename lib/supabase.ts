import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "./config";

// Cliente de servidor con service_role. SOLO se usa para:
//  - escribir log y caché (tablas de operación)
//  - invocar exec_read_sql (que corre el SQL con el rol restringido, no con este)
// NUNCA se expone al navegador.
//
// Se crea de forma perezosa (lazy) para que `next build` no falle al importar el
// módulo sin variables de entorno: el cliente solo se instancia en runtime.
let _admin: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
