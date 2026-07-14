import { Skeleton } from "./Skeleton";

export function TipsPanel({
  tip,
  loading,
  title = "Análisis de IA",
  ai = true,
}: {
  tip: string;
  loading?: boolean;
  title?: string;
  ai?: boolean;
}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {loading ? (
        <Skeleton height={40} />
      ) : tip ? (
        <div className="tip">
          <span className="badge">{ai ? "IA" : "LOCAL"}</span>
          <p>{tip}</p>
        </div>
      ) : (
        <div className="empty">Sin observaciones por ahora.</div>
      )}
    </div>
  );
}
