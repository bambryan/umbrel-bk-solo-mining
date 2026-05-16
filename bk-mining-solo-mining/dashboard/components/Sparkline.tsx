// Tiny pure-SVG line chart + soft fill underneath. No axes, no labels, no
// interactivity. Server-renderable.
//
// We auto-fit Y to the min/max of the visible points; if all values are the
// same (or empty), we draw a flat baseline.

type Props = {
  points: (number | null | undefined)[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  className?: string;
};

export function Sparkline({
  points,
  width = 200,
  height = 44,
  color = "#f59e0b",
  fillOpacity = 0.15,
  className,
}: Props) {
  const clean = points
    .map((p) => (typeof p === "number" && isFinite(p) ? p : null))
    .filter((p): p is number => p !== null);

  if (clean.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className={className}>
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke={color}
          strokeOpacity={0.3}
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;

  // Map ALL incoming points (including nulls) to x coords; nulls become gaps
  // in the polyline by splitting into segments.
  const n = points.length;
  const segments: string[] = [];
  let cur: string[] = [];
  const xy = (i: number, v: number) => {
    const x = (i / (n - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  };
  for (let i = 0; i < n; i++) {
    const v = points[i];
    if (typeof v === "number" && isFinite(v)) {
      cur.push(xy(i, v));
    } else if (cur.length > 0) {
      segments.push(cur.join(" "));
      cur = [];
    }
  }
  if (cur.length > 0) segments.push(cur.join(" "));

  // Build a single area path from the longest unbroken segment so we don't
  // try to fill across gaps (would render misleading "ghost" areas).
  const longest = segments.reduce((a, b) => (b.length > a.length ? b : a), "");
  const longestPts = longest.split(" ").filter(Boolean);
  let areaPath: string | null = null;
  if (longestPts.length >= 2) {
    const first = longestPts[0].split(",");
    const last = longestPts[longestPts.length - 1].split(",");
    areaPath =
      `M ${first[0]},${height} ` +
      `L ${longestPts.join(" L ")} ` +
      `L ${last[0]},${height} Z`;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" className={className}>
      {areaPath && <path d={areaPath} fill={color} fillOpacity={fillOpacity} />}
      {segments.map((seg, i) => (
        <polyline
          key={i}
          points={seg}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
