"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "@/components/Header";
import { KpiRow } from "@/components/KpiRow";
import { ChartPanel } from "@/components/ChartPanel";
import { TipsPanel } from "@/components/TipsPanel";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { DemoBanner } from "@/components/DemoBanner";
import type {
  AskResponse,
  ChartType,
  DashboardData,
  HistoryTurn,
  Row,
} from "@/lib/types";

interface QueryResult {
  title: string;
  chart: ChartType;
  data: Row[];
  tip: string;
  ai: boolean;
}

export default function Page() {
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const historyRef = useRef<HistoryTurn[]>([]);

  // ── Carga base (Modo 0) + refresco en vivo cada 30s ──
  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("dashboard");
      const json = (await res.json()) as DashboardData;
      setDash(json);
      setDashError(false);
    } catch {
      setDashError(true);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    const id = setInterval(loadDashboard, 30_000);
    return () => clearInterval(id);
  }, [loadDashboard]);

  // ── Chat (Modo 2) ──
  const onSend = useCallback(async (question: string) => {
    setMessages((m) => [...m, { role: "user", text: question }]);
    setThinking(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history: historyRef.current }),
      });
      const json = (await res.json()) as AskResponse;

      if (json.ok) {
        setResult({
          title: json.title,
          chart: json.chart,
          data: json.data,
          tip: json.tip,
          ai: json.ai,
        });
        setMessages((m) => [
          ...m,
          {
            role: "bot",
            text: `${json.title} · ${json.data.length} fila(s).${
              json.tip ? `\n${json.tip}` : ""
            }`,
            sql: json.sql_shown,
          },
        ]);
        // memoria de sesión (últimos 8 turnos)
        historyRef.current = [
          ...historyRef.current,
          { q: question, sql: json.sql_shown, title: json.title },
        ].slice(-8);
      } else if (json.needs_clarification) {
        setMessages((m) => [
          ...m,
          { role: "bot", text: json.clarification || "¿Podés aclarar la pregunta?" },
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "bot", text: json.error || "No pude responder eso." },
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "bot", text: "Hubo un error de conexión. Probá de nuevo." },
      ]);
    } finally {
      setThinking(false);
    }
  }, []);

  return (
    <div className="app">
      <Header />

      {dash ? <DemoBanner demo={dash.demo} ai={dash.ai} /> : null}

      <KpiRow data={dash} loading={dashLoading} />

      {dashError ? (
        <div className="card">
          <div className="error">
            No pude cargar los datos. Verificá que la vista v_dashboard y la función
            exec_read_sql existan en Supabase (ver carpeta sql/), y las variables de
            entorno.
          </div>
        </div>
      ) : null}

      <div className="main-grid">
        {/* Columna izquierda: resultado de chat (si hay) + paneles base */}
        <div className="col">
          {result ? (
            <>
              <ChartPanel
                title={`Resultado · ${result.title}`}
                hint="consulta del chat"
                type={result.chart}
                data={result.data}
              />
              <TipsPanel
                tip={result.tip}
                title="Análisis de la consulta"
                ai={result.ai}
              />
            </>
          ) : null}

          <ChartPanel
            title="Jobs por estado"
            type="pie"
            data={dash?.estados ?? []}
            loading={dashLoading}
          />
          <ChartPanel
            title="Carga por técnico"
            type="bar"
            data={dash?.tecnicos ?? []}
            loading={dashLoading}
          />
          <ChartPanel
            title="Ingresos por mes"
            type="line"
            data={dash?.ingresos ?? []}
            loading={dashLoading}
          />
          <TipsPanel
            tip={dash?.tip ?? ""}
            loading={dashLoading}
            title="Resumen del día"
            ai={dash?.ai ?? true}
          />
        </div>

        {/* Columna derecha: chat */}
        <ChatPanel messages={messages} thinking={thinking} onSend={onSend} />
      </div>

      <div className="footer">
        Inti · Jim&apos;s Fencing — datos de solo lectura. La IA controla la vista, no
        los datos.
      </div>
    </div>
  );
}
