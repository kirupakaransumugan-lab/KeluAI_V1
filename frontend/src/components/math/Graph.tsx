import { useId, useMemo, type ReactNode } from "react";
import { parseGraph, sampleFn, sampleParam, ticks, type GraphSpec, type Item, type Pt, type Range } from "./graphSpec";

// Draws a ```graph block (tutor replies, quiz questions and answers) as an inline SVG, no chart
// library: function graphs on axes, or, with "axes": false, mechanics and geometry diagrams.
// Colours follow tutor.css: plum, teal, amber for series; grey for axes and asymptotes.
const W = 400;
const PAD = 26;
const COLORS = ["var(--graph-1)", "var(--graph-2)", "var(--graph-3)"];   // theme.css: plum, teal, amber
const GUIDE = "var(--graph-guide)";

interface Frame { x: Range; y: Range; h: number; sx: (x: number) => number; sy: (y: number) => number }

/** Pixel frame for the spec. With `equal`, one unit is the same length on both axes,
 *  widening a range rather than distorting the picture when the height is clamped. */
function frame(spec: GraphSpec): Frame {
  let [x, y] = [spec.x, spec.y];
  const pw = W - 2 * PAD;
  let ph = 260;
  if (spec.equal) {
    ph = (pw * (y[1] - y[0])) / (x[1] - x[0]);
    if (ph > 440) { const mid = (x[0] + x[1]) / 2, half = ((y[1] - y[0]) * pw) / 440 / 2; x = [mid - half, mid + half]; ph = 440; }
    if (ph < 160) { const mid = (y[0] + y[1]) / 2, half = ((x[1] - x[0]) * 160) / pw / 2; y = [mid - half, mid + half]; ph = 160; }
  }
  const h = ph + 2 * PAD;
  return {
    x, y, h,
    sx: (v) => PAD + ((v - x[0]) / (x[1] - x[0])) * pw,
    sy: (v) => h - PAD - ((v - y[0]) / (y[1] - y[0])) * ph,
  };
}

const fmt = (v: number) => String(+v.toFixed(4)).replace("-", "−");
const rad = (deg: number) => (deg * Math.PI) / 180;
const ARC = 20;                                   // angle-arc radius in svg units

/** Point `len` along direction `deg` (degrees, anticlockwise from +x) from p, in data units. */
const along = (p: Pt, deg: number, len: number): Pt => [p[0] + len * Math.cos(rad(deg)), p[1] + len * Math.sin(rad(deg))];

/**
 * The arc marking angle AOB at O, in screen space, plus where its label goes.
 * Screen y points down, so a maths angle is measured with -dy; the smaller of the two
 * arcs is drawn. SVG sweep-flag 0 runs anticlockwise on screen, i.e. increasing maths angle.
 */
function angleArc(a: Pt, o: Pt, b: Pt, f: Frame, right: boolean) {
  const [ox, oy] = [f.sx(o[0]), f.sy(o[1])];
  const dir = (p: Pt) => Math.atan2(-(f.sy(p[1]) - oy), f.sx(p[0]) - ox);
  const ta = dir(a), tb = dir(b);
  let d = tb - ta;
  while (d <= -Math.PI) d += 2 * Math.PI;
  while (d > Math.PI) d -= 2 * Math.PI;
  const at = (t: number, r: number): [number, number] => [ox + r * Math.cos(t), oy - r * Math.sin(t)];
  let shape: string;
  if (right) {
    const s = ARC * 0.55, [ux, uy] = [Math.cos(ta), -Math.sin(ta)], [vx, vy] = [Math.cos(tb), -Math.sin(tb)];
    shape = `M${ox + ux * s},${oy + uy * s}L${ox + (ux + vx) * s},${oy + (uy + vy) * s}L${ox + vx * s},${oy + vy * s}`;
  } else {
    const [p1, p2] = [at(ta, ARC), at(tb, ARC)];
    shape = `M${p1[0].toFixed(1)},${p1[1].toFixed(1)}A${ARC},${ARC} 0 0 ${d > 0 ? 0 : 1} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const [lx, ly] = at(ta + d / 2, ARC + 12);
  return { shape, label: { x: lx, y: ly + 4 } };
}
const path = (run: Pt[], f: Frame) => run.map(([x, y], i) => `${i ? "L" : "M"}${f.sx(x).toFixed(1)},${f.sy(y).toFixed(1)}`).join("");

/** Where an item's label goes, in data coordinates, plus its text anchor. */
function labelSpot(it: Item, f: Frame, runs: Pt[][]): { p: Pt; anchor: "start" | "middle" | "end" } | null {
  if (it.at) return { p: it.at, anchor: "middle" };
  switch (it.kind) {
    case "fn": case "param": case "polyline": {
      const inside = runs.flat().filter(([x, y]) => x >= f.x[0] && x <= f.x[1] && y >= f.y[0] && y <= f.y[1]);
      return inside.length ? { p: inside[inside.length - 1], anchor: "end" } : null;
    }
    case "vline": return { p: [it.v, f.y[1]], anchor: "start" };
    case "hline": return { p: [f.x[1], it.v], anchor: "end" };
    case "line": case "segment": return { p: [(it.a[0] + it.b[0]) / 2, (it.a[1] + it.b[1]) / 2], anchor: "start" };
    case "polygon": return { p: [it.pts.reduce((s, q) => s + q[0], 0) / it.pts.length, it.pts.reduce((s, q) => s + q[1], 0) / it.pts.length], anchor: "middle" };
    case "circle": return { p: [it.c[0] + it.r * Math.SQRT1_2, it.c[1] + it.r * Math.SQRT1_2], anchor: "start" };
    case "shade": { const m = (it.from + it.to) / 2; let v = 0; try { v = it.f({ x: m }) / 2; } catch { /* keep 0 */ } return { p: [m, v], anchor: "middle" }; }
    case "point": return { p: it.p, anchor: "start" };
    case "text": return { p: it.p, anchor: "middle" };
    case "force": return { p: along(it.p, it.dir, it.len), anchor: Math.cos(rad(it.dir)) < -0.3 ? "end" : "start" };
    case "particle": return { p: it.p, anchor: "start" };
    case "block": return { p: it.c, anchor: "middle" };
    case "pulley": return { p: [it.c[0] + it.r, it.c[1] + it.r], anchor: "start" };
    case "ground": return { p: [(it.a[0] + it.b[0]) / 2, (it.a[1] + it.b[1]) / 2], anchor: "middle" };
    case "incline": case "angle": return null;        // placed beside their arc, in drawItem
  }
}

/** The item's shape (drawn clipped to the plot) and its label (drawn unclipped, on top). */
function drawItem(it: Item, f: Frame, marker: (c: number) => string): { shape: ReactNode; label: Label | null } {
  const stroke = it.kind === "vline" || it.kind === "hline" ? GUIDE : COLORS[it.color - 1];
  const line = { stroke, strokeWidth: 2, fill: "none", strokeDasharray: it.dash ? "6 4" : undefined, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  let runs: Pt[][] = [];
  let shape: ReactNode = null;

  switch (it.kind) {
    case "fn": runs = sampleFn(it.f, it.domain ?? f.x, f.y); break;
    case "param": runs = sampleParam(it.fx, it.fy, it.t); break;
    case "polyline": runs = [it.pts]; break;
    case "vline": shape = <line x1={f.sx(it.v)} x2={f.sx(it.v)} y1={f.sy(f.y[0])} y2={f.sy(f.y[1])} {...line} strokeWidth={1.5} />; break;
    case "hline": shape = <line x1={f.sx(f.x[0])} x2={f.sx(f.x[1])} y1={f.sy(it.v)} y2={f.sy(it.v)} {...line} strokeWidth={1.5} />; break;
    case "line": {
      const [[x1, y1], [x2, y2]] = [it.a, it.b];
      if (Math.abs(x2 - x1) < 1e-12) { shape = <line x1={f.sx(x1)} x2={f.sx(x1)} y1={f.sy(f.y[0])} y2={f.sy(f.y[1])} {...line} />; break; }
      const m = (y2 - y1) / (x2 - x1), at = (x: number) => y1 + m * (x - x1);
      shape = <line x1={f.sx(f.x[0])} y1={f.sy(at(f.x[0]))} x2={f.sx(f.x[1])} y2={f.sy(at(f.x[1]))} {...line} />;
      break;
    }
    case "segment":
      shape = <line x1={f.sx(it.a[0])} y1={f.sy(it.a[1])} x2={f.sx(it.b[0])} y2={f.sy(it.b[1])} {...line}
        markerEnd={it.arrow ? marker(it.color) : undefined} />;
      break;
    case "polygon":
      shape = <path d={path(it.pts, f) + "Z"} {...line} fill={stroke} fillOpacity={0.1} />;
      break;
    case "circle": {
      const rx = Math.abs(f.sx(it.c[0] + it.r) - f.sx(it.c[0])), ry = Math.abs(f.sy(it.c[1] + it.r) - f.sy(it.c[1]));
      shape = <ellipse cx={f.sx(it.c[0])} cy={f.sy(it.c[1])} rx={rx} ry={ry} {...line} />;
      break;
    }
    case "shade": {
      const top = sampleFn(it.f, [it.from, it.to], f.y, 160).flat();
      if (top.length > 1) shape = <path d={`${path([[it.from, 0], ...top, [it.to, 0]], f)}Z`} fill={stroke} fillOpacity={0.18} stroke="none" />;
      break;
    }
    case "point":
      shape = <circle cx={f.sx(it.p[0])} cy={f.sy(it.p[1])} r={3.5} fill={it.open ? "var(--graph-bg)" : stroke} stroke={stroke} strokeWidth={1.5} />;
      break;
    case "text": break;
    case "force": {
      const end = along(it.p, it.dir, it.len);
      shape = <line x1={f.sx(it.p[0])} y1={f.sy(it.p[1])} x2={f.sx(end[0])} y2={f.sy(end[1])} {...line}
        strokeWidth={2.2} markerEnd={marker(it.color)} />;
      break;
    }
    case "particle":
      shape = <circle cx={f.sx(it.p[0])} cy={f.sy(it.p[1])} r={5} fill={stroke} />;
      break;
    case "block": {
      // Corners turned about the centre in data space, so the block sits flush on a slope.
      const c = Math.cos(rad(it.rot)), s = Math.sin(rad(it.rot));
      const corners: Pt[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => {
        const [dx, dy] = [(u * it.w) / 2, (v * it.h) / 2];
        return [it.c[0] + dx * c - dy * s, it.c[1] + dx * s + dy * c];
      });
      shape = <path d={path(corners, f) + "Z"} {...line} fill="var(--graph-bg)" strokeDasharray={undefined} />;
      break;
    }
    case "incline": {
      const top: Pt = along(it.p, it.angle, it.length), foot: Pt = [top[0], it.p[1]];
      const arc = angleArc(foot, it.p, top, f, false);
      shape = (
        <>
          <path d={path([it.p, foot, top], f) + "Z"} stroke={GUIDE} strokeWidth={1.5} fill={GUIDE} fillOpacity={0.12} strokeLinejoin="round" />
          <path d={arc.shape} stroke={GUIDE} strokeWidth={1.3} fill="none" />
        </>
      );
      const text = it.label ?? `${+it.angle.toFixed(1)}°`;
      return { shape, label: { x: arc.label.x + 4, y: arc.label.y, anchor: "start", text, fill: "var(--ink)" } };
    }
    case "pulley": {
      const rx = Math.abs(f.sx(it.c[0] + it.r) - f.sx(it.c[0])), ry = Math.abs(f.sy(it.c[1] + it.r) - f.sy(it.c[1]));
      shape = (
        <>
          <ellipse cx={f.sx(it.c[0])} cy={f.sy(it.c[1])} rx={rx} ry={ry} {...line} fill="var(--graph-bg)" />
          <circle cx={f.sx(it.c[0])} cy={f.sy(it.c[1])} r={2.5} fill={stroke} />
        </>
      );
      break;
    }
    case "ground": {
      // Short hatch strokes on the underside (right of the direction a -> b on screen).
      const [x1, y1, x2, y2] = [f.sx(it.a[0]), f.sy(it.a[1]), f.sx(it.b[0]), f.sy(it.b[1])];
      const len = Math.hypot(x2 - x1, y2 - y1) || 1, [ux, uy] = [(x2 - x1) / len, (y2 - y1) / len];
      const [nx, ny] = [-uy, ux];
      let hatch = "";
      for (let t = 6; t < len; t += 9) {
        const [qx, qy] = [x1 + ux * t, y1 + uy * t];
        hatch += `M${qx.toFixed(1)},${qy.toFixed(1)}l${(5 * (nx - ux)).toFixed(1)},${(5 * (ny - uy)).toFixed(1)}`;
      }
      shape = (
        <>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={GUIDE} strokeWidth={2} strokeLinecap="round" />
          <path d={hatch} stroke={GUIDE} strokeWidth={1.1} fill="none" />
        </>
      );
      break;
    }
    case "angle": {
      const arc = angleArc(it.a, it.o, it.b, f, it.right);
      shape = <path d={arc.shape} stroke={stroke} strokeWidth={1.5} fill="none" />;
      const label = it.label ? { x: arc.label.x, y: arc.label.y, anchor: "middle" as const, text: it.label, fill: stroke } : null;
      return { shape, label };
    }
  }
  if (runs.length) shape = <path d={runs.map((r) => path(r, f)).join("")} {...line} />;

  const spot = it.label ? labelSpot(it, f, runs) : null;
  let label: Label | null = null;
  if (spot && it.label) {
    const dx = spot.anchor === "start" ? 6 : spot.anchor === "end" ? -4 : 0;
    label = {
      x: Math.min(W - 4, Math.max(4, f.sx(spot.p[0]) + dx)),
      y: Math.min(f.h - 4, Math.max(12, f.sy(spot.p[1]) - 6)),
      anchor: spot.anchor, text: it.label, fill: it.kind === "text" ? "var(--ink)" : stroke,
    };
  }
  return { shape, label };
}

interface Label { x: number; y: number; anchor: "start" | "middle" | "end"; text: string; fill: string }

const LINE = 14;                                  // label line height in svg units (11.5px text)

/** Horizontal extent of a label; ~6.4 units per character at the label font size. */
function span(l: Label): [number, number] {
  const w = l.text.length * 6.4;
  const left = l.anchor === "start" ? l.x : l.anchor === "end" ? l.x - w : l.x - w / 2;
  return [left, left + w];
}

/** Place labels in order, moving each one down a line while it would sit on one already
 *  placed (two curves leaving the top of the plot side by side used to print on top of each other). */
function spread(labels: (Label | null)[], h: number): (Label | null)[] {
  const placed: Label[] = [];
  return labels.map((l) => {
    if (!l) return null;
    const [a, b] = span(l);
    let y = l.y;
    for (let tries = 0; tries < 6; tries++) {
      const hit = placed.some((p) => { const [c, d] = span(p); return a < d && c < b && Math.abs(p.y - y) < LINE; });
      if (!hit) break;
      y = y + LINE > h - 4 ? y - LINE : y + LINE;
    }
    const out = { ...l, y };
    placed.push(out);
    return out;
  });
}

function Axes({ f, names, arrow }: { f: Frame; names: [string, string]; arrow: string }) {
  const ax = f.y[0] <= 0 && f.y[1] >= 0 ? f.sy(0) : f.sy(f.y[0]);     // where the x-axis sits
  const ay = f.x[0] <= 0 && f.x[1] >= 0 ? f.sx(0) : f.sx(f.x[0]);     // where the y-axis sits
  const xs = ticks(f.x), ys = ticks(f.y);
  return (
    <g className="gr-axes">
      {xs.map((v) => <line key={`gx${v}`} x1={f.sx(v)} x2={f.sx(v)} y1={f.sy(f.y[0])} y2={f.sy(f.y[1])} className="gr-grid" />)}
      {ys.map((v) => <line key={`gy${v}`} y1={f.sy(v)} y2={f.sy(v)} x1={f.sx(f.x[0])} x2={f.sx(f.x[1])} className="gr-grid" />)}
      <line x1={f.sx(f.x[0])} x2={f.sx(f.x[1]) + 8} y1={ax} y2={ax} className="gr-axis" markerEnd={arrow} />
      <line y1={f.sy(f.y[0])} y2={f.sy(f.y[1]) - 8} x1={ay} x2={ay} className="gr-axis" markerEnd={arrow} />
      {xs.filter((v) => v !== 0).map((v) => <text key={`tx${v}`} x={f.sx(v)} y={ax + 13} textAnchor="middle" className="gr-tick">{fmt(v)}</text>)}
      {ys.filter((v) => v !== 0).map((v) => <text key={`ty${v}`} x={ay - 5} y={f.sy(v) + 3.5} textAnchor="end" className="gr-tick">{fmt(v)}</text>)}
      {ax === f.sy(0) && ay === f.sx(0) && <text x={ay - 5} y={ax + 13} textAnchor="end" className="gr-tick">O</text>}
      <text x={f.sx(f.x[1]) + 6} y={ax - 7} textAnchor="end" className="gr-name">{names[0]}</text>
      <text x={ay + 7} y={f.sy(f.y[1]) - 4} className="gr-name">{names[1]}</text>
    </g>
  );
}

export function Graph({ source }: { source: string }) {
  const spec = useMemo(() => parseGraph(source), [source]);
  const id = useId().replace(/:/g, "");
  if (!spec) return <div className="gr-fail">Graph could not be drawn · வரைபடத்தை வரைய முடியவில்லை</div>;

  const f = frame(spec);
  const marker = (c: number) => `url(#${id}-arrow${c})`;
  const drawn = spec.items.map((it) => drawItem(it, f, marker));
  return (
    <figure className="gr">
      <svg viewBox={`0 0 ${W} ${f.h}`} role="img" aria-label={spec.title ?? (spec.showAxes ? "Graph" : "Diagram")}>
        <defs>
          <clipPath id={`${id}-clip`}><rect x={PAD} y={PAD} width={W - 2 * PAD} height={f.h - 2 * PAD} /></clipPath>
          <marker id={`${id}-arrow0`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,1L9,5L0,9Z" fill={GUIDE} />
          </marker>
          {COLORS.map((c, i) => (
            <marker key={c} id={`${id}-arrow${i + 1}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,1L9,5L0,9Z" fill={c} />
            </marker>
          ))}
        </defs>
        {spec.showAxes && <Axes f={f} names={spec.axes} arrow={marker(0)} />}
        <g clipPath={`url(#${id}-clip)`}>{drawn.map((d, i) => <g key={i}>{d.shape}</g>)}</g>
        {spread(drawn.map((d) => d.label), f.h).map((l, i) => l && (
          <text key={i} x={l.x} y={l.y} textAnchor={l.anchor} className="gr-label" fill={l.fill}>{l.text}</text>
        ))}
      </svg>
      {(spec.title || spec.dropped > 0) && (
        <figcaption>
          {spec.title}
          {spec.dropped > 0 && <span className="gr-dropped"> ({spec.dropped} part{spec.dropped > 1 ? "s" : ""} not shown)</span>}
        </figcaption>
      )}
    </figure>
  );
}
