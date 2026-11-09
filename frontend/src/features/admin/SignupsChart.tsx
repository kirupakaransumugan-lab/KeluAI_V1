import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

// Signups per day: one series, so no legend (the card title names it). Plum line, 2px, with a
// soft fill to the baseline; recessive grid. A crosshair snaps to the nearest day on hover,
// and the arrow keys move it for keyboard users. The same numbers are in the table below it.
const W = 640, H = 230;
const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

interface Point { date: string; count: number }

const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-LK", { day: "numeric", month: "short" });

/** A round top for the y axis and 4-5 integer gridlines under it. */
function yScale(max: number): { top: number; ticks: number[] } {
  const raw = Math.max(4, max) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

export function SignupsChart({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gradId = useId().replace(/:/g, "");
  const { top, ticks } = useMemo(() => yScale(Math.max(0, ...data.map((d) => d.count))), [data]);

  const n = data.length;
  const sx = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * (W - PAD.left - PAD.right) : 0);
  const sy = (v: number) => H - PAD.bottom - (v / top) * (H - PAD.top - PAD.bottom);
  const line = data.map((d, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(d.count).toFixed(1)}`).join("");
  const area = n ? `${line}L${sx(n - 1).toFixed(1)},${sy(0)}L${sx(0).toFixed(1)},${sy(0)}Z` : "";
  const every = Math.max(1, Math.ceil(n / 7));                  // ~7 date labels whatever the range

  const nearest = (e: PointerEvent<SVGSVGElement>) => {
    const box = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round(((x - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1))));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setHover((h) => Math.max(0, Math.min(n - 1, (h ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
  };

  const total = data.reduce((s, d) => s + d.count, 0);
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="ad-chart">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" tabIndex={0}
        aria-label={`Signups per day: ${total} in ${n} days. Use the arrow keys to read each day.`}
        onPointerMove={(e) => setHover(nearest(e))} onPointerLeave={() => setHover(null)}
        onKeyDown={onKey} onBlur={() => setHover(null)}>
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--graph-1)" stopOpacity="0.22" />
            <stop offset="1" stopColor="var(--graph-1)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={sy(t)} y2={sy(t)} className={t ? "ad-grid" : "ad-base"} />
            <text x={PAD.left - 8} y={sy(t) + 4} textAnchor="end" className="ad-tick">{t}</text>
          </g>
        ))}
        {data.map((d, i) => (i % every === 0 || i === n - 1) && (i === n - 1 || n - 1 - i >= every / 2) && (
          // The end labels hug their edge so neither is cut off.
          <text key={d.date} x={sx(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            className="ad-tick">{day(d.date)}</text>
        ))}
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke="var(--graph-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {h && hover !== null && (
          <g>
            <line x1={sx(hover)} x2={sx(hover)} y1={PAD.top} y2={sy(0)} className="ad-cross" />
            <circle cx={sx(hover)} cy={sy(h.count)} r="5" fill="var(--graph-1)" stroke="var(--graph-bg)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && hover !== null && (
        <div className="ad-tip" role="status"
          style={{ left: `${(sx(hover) / W) * 100}%`, top: `${(sy(h.count) / H) * 100}%` }}>
          <b><strong>{h.count}</strong> signup{h.count === 1 ? "" : "s"}</b>
          <span>{new Date(`${h.date}T00:00:00`).toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" })}</span>
        </div>
      )}
      {total === 0 && <p className="ad-chart-empty">No signups in this range yet.</p>}
      <details className="ad-table-toggle">
        <summary>Show as table</summary>
        <table className="ad-table ad-table-compact">
          <thead><tr><th scope="col">Date</th><th scope="col">Signups</th></tr></thead>
          <tbody>{[...data].reverse().map((d) => <tr key={d.date}><td>{day(d.date)}</td><td>{d.count}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
