export function Skeleton({
  height = 16,
  width = "100%",
  style,
}: {
  height?: number | string;
  width?: number | string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="skeleton"
      style={{ height, width, ...style }}
      aria-hidden="true"
    />
  );
}
