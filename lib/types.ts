// Tipos compartidos entre el backend (/api) y el frontend.

export type ChartType = "bar" | "line" | "pie" | "table" | "kpi";

export type Row = Record<string, string | number | null>;

// Lo que Claude devuelve al traducir lenguaje natural -> SQL.
export interface Translation {
  needs_clarification: boolean;
  clarification?: string;
  sql?: string;
  chart?: ChartType;
  title?: string;
}

// Turno de conversación que el front guarda y reenvía (memoria de sesión).
// role/content para dárselo a Claude como conversación real (incluye aclaraciones).
export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

// Respuesta de /api/ask
export type AskResponse =
  | {
      ok: true;
      data: Row[];
      chart: ChartType;
      title: string;
      tip: string;
      sql_shown: string;
      ai: boolean; // true = tip generado por Claude; false = analista local
    }
  | {
      ok: false;
      error?: string;
      needs_clarification?: boolean;
      clarification?: string;
    };

// Respuesta de /api/dashboard (carga base, Modo 0)
export interface DashboardData {
  kpis: {
    total_jobs: number;
    completados: number;
    work_order: number;
    ingresos_mes: number;
  };
  estados: Row[]; // { estado, total }
  tecnicos: Row[]; // { tecnico, total }
  ingresos: Row[]; // { mes, total }
  tip: string;
  generated_at: string;
  demo: boolean; // true = datos sembrados en PGlite (sin Supabase)
  ai: boolean; // true = Claude activo; false = analista local
}
