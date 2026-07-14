import { KpiCard } from "./KpiCard";
import { formatMoney, formatNumber } from "./chartUtils";
import type { DashboardData } from "@/lib/types";

export function KpiRow({
  data,
  loading,
}: {
  data: DashboardData | null;
  loading: boolean;
}) {
  const k = data?.kpis;
  return (
    <div className="kpi-row">
      <KpiCard
        label="Jobs totales"
        value={k ? formatNumber(k.total_jobs) : "—"}
        tone="steel"
        loading={loading}
      />
      <KpiCard
        label="Completados"
        value={k ? formatNumber(k.completados) : "—"}
        tone="ok"
        loading={loading}
      />
      <KpiCard
        label="En curso (Work Order)"
        value={k ? formatNumber(k.work_order) : "—"}
        tone="warn"
        loading={loading}
      />
      <KpiCard
        label="Ingresos del mes"
        value={k ? formatMoney(k.ingresos_mes) : "—"}
        tone="steel"
        loading={loading}
      />
    </div>
  );
}
