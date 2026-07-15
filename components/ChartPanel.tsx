"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { ChartType, Row } from "@/lib/types";
import { CHART_COLORS, inferKeys, formatMoney, formatNumber } from "./chartUtils";
import { Skeleton } from "./Skeleton";

const AXIS = { fill: "#8b9bb0", fontSize: 12 };
const tooltipStyle = {
  background: "#1a2330",
  border: "1px solid #243140",
  borderRadius: 8,
  color: "#e6edf3",
};

export function ChartPanel({
  title,
  hint,
  type,
  data,
  loading,
}: {
  title: string;
  hint?: string;
  type: ChartType;
  data: Row[];
  loading?: boolean;
}) {
  return (
    <div className="card">
      <h3>
        {title}
        {hint ? <span className="hint">{hint}</span> : null}
      </h3>
      {loading ? (
        <Skeleton height={260} />
      ) : !data || data.length === 0 ? (
        <div className="empty">Sin datos para mostrar.</div>
      ) : (
        <ChartBody type={type} data={data} />
      )}
    </div>
  );
}

function ChartBody({ type, data }: { type: ChartType; data: Row[] }) {
  const { cat, num } = inferKeys(data);

  // Un solo resultado con pocas columnas (ej. "cuántos completados",
  // "ingresos totales", "monto de Paulo") se muestra como número grande.
  // Si tiene muchas columnas es un detalle → va como tabla.
  if (data.length === 1 && Object.keys(data[0]).length <= 4) {
    return <SingleStat row={data[0]} />;
  }

  // Tabla: o pedido explícito, o cuando no se puede inferir un eje numérico.
  if (type === "table" || !cat || !num) {
    return <DataTable data={data} />;
  }

  const numericData = data.map((r) => ({ ...r, [num]: Number(r[num] ?? 0) }));

  if (type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={numericData}
            dataKey={num}
            nameKey={cat}
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {numericData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#8b9bb0" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={numericData}>
          <CartesianGrid stroke="#243140" strokeDasharray="3 3" />
          <XAxis dataKey={cat} tick={AXIS} />
          <YAxis tick={AXIS} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey={num}
            stroke="#5b8def"
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // bar (default)
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={numericData}>
        <CartesianGrid stroke="#243140" strokeDasharray="3 3" />
        <XAxis dataKey={cat} tick={AXIS} />
        <YAxis tick={AXIS} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#1a2330" }} />
        <Bar dataKey={num} radius={[4, 4, 0, 0]}>
          {numericData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function looksLikeMoney(key: string): boolean {
  return /monto|factur|ingres|precio|total|promedio|revenue|cost/i.test(key);
}

function formatValue(key: string, v: string | number | null): string {
  if (v === null || v === "") return "—";
  const n = Number(v);
  if (v !== "" && !isNaN(n)) {
    return looksLikeMoney(key) ? formatMoney(n) : formatNumber(n);
  }
  return String(v);
}

// Resultado de una sola fila: los números van grandes; el texto (ej. el nombre
// del técnico) se usa como etiqueta. Si no hay ningún número, cae a tabla.
function SingleStat({ row }: { row: Row }) {
  const entries = Object.entries(row);
  const isNum = (v: Row[string]) => v !== null && v !== "" && !isNaN(Number(v));
  const nums = entries.filter(([, v]) => isNum(v));
  const texts = entries.filter(([, v]) => !isNum(v));

  if (nums.length === 0) return <DataTable data={[row]} />;

  const caption =
    texts.length > 0 ? texts.map(([, tv]) => String(tv)).join(" · ") : null;

  return (
    <div className="single-stat">
      {nums.map(([k, v]) => (
        <div className="stat-item" key={k}>
          <div className="stat-value">{formatValue(k, v)}</div>
          <div className="stat-label">{caption || k.replace(/_/g, " ")}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ data }: { data: Row[] }) {
  const cols = Object.keys(data[0]);
  return (
    <div className="tbl-wrap">
      <table className="tbl">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={c}>{row[c] === null ? "—" : String(row[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
