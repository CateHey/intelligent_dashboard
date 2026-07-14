import { Skeleton } from "./Skeleton";

export function KpiCard({
  label,
  value,
  tone = "steel",
  loading,
}: {
  label: string;
  value: string;
  tone?: "steel" | "ok" | "warn" | "danger";
  loading?: boolean;
}) {
  const cls = tone === "steel" ? "kpi" : `kpi ${tone}`;
  return (
    <div className={cls}>
      <div className="label">{label}</div>
      {loading ? (
        <Skeleton height={30} width="60%" style={{ marginTop: 8 }} />
      ) : (
        <div className="value">{value}</div>
      )}
      <div className="accent" />
    </div>
  );
}
