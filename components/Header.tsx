"use client";

import { useEffect, useState } from "react";

export function Header() {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => {
      setClock(
        new Intl.DateTimeFormat("es-AU", {
          timeZone: "Australia/Perth",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date())
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="header">
      <div className="brand">
        <div className="mark">JF</div>
        <div>
          <h1>Inti · Jim&apos;s Fencing</h1>
          <div className="sub">Dashboard de operaciones en vivo</div>
        </div>
      </div>
      <div className="header-right">
        <div className="live">
          <span className="dot" />
          En vivo
        </div>
        <div className="clock">{clock ? `${clock} Perth` : "—"}</div>
      </div>
    </header>
  );
}
