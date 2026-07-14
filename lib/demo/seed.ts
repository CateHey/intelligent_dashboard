// Datos sembrados para el MODO DEMO. Determinísticos (semilla fija) para que la
// demo sea siempre igual. Simulan la operación de Jim's Fencing en Perth.

export interface SeedRow {
  job_id: string;
  job_uuid: string;
  estado: string;
  cliente: string;
  ciudad: string;
  tecnico: string | null;
  monto: number;
  monto_extra: number;
  resultado: string | null;
  fecha_regreso: string | null; // YYYY-MM-DD
  fecha: string; // ISO
}

// LCG simple: números pseudo-aleatorios reproducibles.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TECNICOS = [
  "Paulo Ferreira",
  "Dave Nguyen",
  "Marco Silva",
  "Sam O'Brien",
  "Liam Walsh",
];

const CIUDADES = [
  "Joondalup",
  "Fremantle",
  "Midland",
  "Rockingham",
  "Armadale",
  "Canning Vale",
  "Scarborough",
];

const CLIENTES = [
  "Perth Property Group",
  "Coastal Homes WA",
  "Bunnings Trade",
  "Sunset Developments",
  "Riverside Estates",
  "Metro Build Co",
  "Harborline Realty",
  "Southern Cross Homes",
  "Karrinyup Retail",
  "Westfield Maintenance",
  "Vista Landscaping",
  "Ocean Reef Strata",
];

function pick<T>(r: () => number, arr: T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function iso(daysAgo: number, r: () => number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(Math.floor(r() * 10) + 7, Math.floor(r() * 60), 0, 0);
  return d.toISOString();
}

function ymd(baseIso: string, plusDays: number): string {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + plusDays);
  return d.toISOString().slice(0, 10);
}

export function buildSeed(count = 220): SeedRow[] {
  const r = rng(20260626);
  const rows: SeedRow[] = [];

  for (let i = 0; i < count; i++) {
    const roll = r();
    // Distribución de estados realista.
    let estado: string;
    if (roll < 0.6) estado = "Completed";
    else if (roll < 0.85) estado = "Work Order";
    else if (roll < 0.95) estado = "Quote";
    else estado = "Unsuccessful";

    // Paulo sale un poco sobrecargado y con más incidentes: le da algo real
    // que decir al panel de análisis.
    const tecnico =
      estado === "Quote" ? null : r() < 0.32 ? TECNICOS[0] : pick(r, TECNICOS);

    let resultado: string | null = null;
    if (estado === "Completed") resultado = "completed";
    else if (estado === "Work Order") {
      const rr = r();
      const pauloBias = tecnico === TECNICOS[0] ? 0.15 : 0;
      if (rr < 0.45) resultado = "reschedule_clear";
      else if (rr < 0.75 - pauloBias) resultado = "reschedule_unclear";
      else resultado = "issue_on_site";
    } else if (estado === "Unsuccessful") resultado = "issue_on_site";

    const fecha = iso(Math.floor(r() * 240), r);
    const monto =
      estado === "Quote" ? 0 : Math.round((400 + r() * 6100) / 10) * 10;
    const monto_extra = r() < 0.28 ? Math.round((50 + r() * 750) / 10) * 10 : 0;

    rows.push({
      job_id: String(1200 + i),
      job_uuid: `demo-${String(i).padStart(4, "0")}`,
      estado,
      cliente: pick(r, CLIENTES),
      ciudad: pick(r, CIUDADES),
      tecnico,
      monto,
      monto_extra,
      resultado,
      fecha_regreso:
        resultado === "reschedule_clear"
          ? ymd(fecha, 3 + Math.floor(r() * 12))
          : null,
      fecha,
    });
  }

  return rows;
}
