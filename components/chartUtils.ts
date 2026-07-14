import type { Row } from "@/lib/types";

export const CHART_COLORS = [
  "#5b8def",
  "#2fbf71",
  "#f5a623",
  "#e5484d",
  "#9b7bef",
  "#36c5cd",
  "#c06bef",
  "#8b9bb0",
];

// Detecta una columna categórica (texto) y una numérica para graficar.
export function inferKeys(data: Row[]): { cat: string | null; num: string | null } {
  if (!data || data.length === 0) return { cat: null, num: null };
  const keys = Object.keys(data[0]);
  let cat: string | null = null;
  let num: string | null = null;

  for (const k of keys) {
    const v = data[0][k];
    const isNum = typeof v === "number" || (v !== null && v !== "" && !isNaN(Number(v)));
    if (isNum && num === null) num = k;
    else if (!isNum && cat === null) cat = k;
  }
  // Si no hubo categórica clara, usa la primera columna.
  if (cat === null) cat = keys[0] ?? null;
  // Si no hubo numérica, intenta la segunda columna.
  if (num === null) num = keys.find((k) => k !== cat) ?? null;
  return { cat, num };
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-AU").format(n);
}
