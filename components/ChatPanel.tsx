"use client";

import { useEffect, useRef, useState } from "react";

export interface ChatMessage {
  role: "user" | "bot";
  text: string;
  sql?: string;
}

const SUGGESTIONS = [
  "Jobs por estado",
  "Jobs por técnico este mes",
  "Ingresos por mes",
  "Incidentes en sitio",
  "Trabajos incompletos",
];

export function ChatPanel({
  messages,
  thinking,
  onSend,
}: {
  messages: ChatMessage[];
  thinking: boolean;
  onSend: (q: string) => void;
}) {
  const [input, setInput] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = (q: string) => {
    const text = q.trim();
    if (!text || thinking) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className="card chat">
      <h3>
        Chat
        <span className="hint">preguntá en lenguaje natural</span>
      </h3>

      <div className="chat-log" ref={logRef}>
        {messages.length === 0 ? (
          <div className="msg bot">
            Hola 👋 Preguntame por los datos del negocio. Por ejemplo: “jobs por
            técnico este mes”.
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.text}
              {m.sql ? <div className="sql">{m.sql}</div> : null}
            </div>
          ))
        )}
        {thinking ? <div className="thinking">pensando…</div> : null}
      </div>

      <div className="chips">
        {SUGGESTIONS.map((s) => (
          <span key={s} className="chip" onClick={() => send(s)}>
            {s}
          </span>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={input}
          placeholder="Escribí tu pregunta…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") send(input);
          }}
        />
        <button className="btn" disabled={thinking || !input.trim()} onClick={() => send(input)}>
          Enviar
        </button>
      </div>
    </div>
  );
}
