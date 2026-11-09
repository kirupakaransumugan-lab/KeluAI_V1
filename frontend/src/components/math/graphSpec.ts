// Graph blocks in tutor replies: ```graph {json}``` (format in backend/app/rag/agent/prompts.py).
// The JSON comes from the model, so nothing here trusts it: expressions go through a small
// parser (never eval / new Function) and every item is checked; bad items are dropped.

export type Pt = [number, number];
export type Range = [number, number];

interface Common { label?: string; dash?: boolean; color: number; at?: Pt }

export type Item = Common & (
  | { kind: "fn"; f: Expr; domain?: Range }
  | { kind: "param"; fx: Expr; fy: Expr; t: Range }
  | { kind: "vline"; v: number }
  | { kind: "hline"; v: number }
  | { kind: "line"; a: Pt; b: Pt }
  | { kind: "segment"; a: Pt; b: Pt; arrow: boolean }
  | { kind: "polyline"; pts: Pt[] }
  | { kind: "polygon"; pts: Pt[] }
  | { kind: "circle"; c: Pt; r: number }
  | { kind: "shade"; f: Expr; from: number; to: number }
  | { kind: "point"; p: Pt; open: boolean }
  | { kind: "text"; p: Pt }
  // Mechanics and geometry kit (usually with "axes": false). Angles are in degrees,
  // anticlockwise from the positive x-direction.
  | { kind: "force"; p: Pt; dir: number; len: number }
  | { kind: "particle"; p: Pt }
  | { kind: "block"; c: Pt; w: number; h: number; rot: number }
  | { kind: "incline"; p: Pt; angle: number; length: number }
  | { kind: "pulley"; c: Pt; r: number }
  | { kind: "ground"; a: Pt; b: Pt }
  | { kind: "angle"; a: Pt; o: Pt; b: Pt; right: boolean }
);

export interface GraphSpec {
  x: Range; y: Range;
  axes: [string, string];
  showAxes: boolean;        // false: a diagram (forces, geometry) with no axes or grid
  equal: boolean;
  title?: string;
  items: Item[];
  dropped: number;          // items that could not be understood
}

// ---------- Expressions ----------

export type Expr = (vars: Record<string, number>) => number;

const FUNCS: Record<string, (a: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sec: (a) => 1 / Math.cos(a), cosec: (a) => 1 / Math.sin(a), csc: (a) => 1 / Math.sin(a),
  cot: (a) => 1 / Math.tan(a), sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, exp: Math.exp,
};
const CONSTS: Record<string, number> = { pi: Math.PI, e: Math.E };

type Tok = { t: "num"; v: number } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const s = src.replace(/π/g, "pi").replace(/[−–]/g, "-").replace(/[×·]/g, "*")
    .replace(/²/g, "^2").replace(/³/g, "^3").toLowerCase();
  const out: Tok[] = [];
  const re = /\s*(?:(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)|([a-z]+)|(\S))/gy;
  let m: RegExpExecArray | null;
  while (re.lastIndex < s.length && (m = re.exec(s))) {
    if (m[1]) out.push({ t: "num", v: Number(m[1]) });
    else if (m[2]) out.push({ t: "id", v: m[2] });
    else if (m[3]) {
      if (!"+-*/^()|,".includes(m[3])) throw new Error(`bad char ${m[3]}`);
      out.push({ t: "op", v: m[3] });
    }
  }
  return out;
}

/** Compile "2x^2 - sin(x)/3" into a function of the named variables. Throws on bad input. */
export function compile(src: string, vars: string[]): Expr {
  if (src.length > 300) throw new Error("expression too long");
  const toks = tokenize(src);
  let i = 0;
  let bars = 0;                           // open |...| pairs: inside one, a "|" closes it
  const peek = () => toks[i];
  const isOp = (v: string) => peek()?.t === "op" && peek()!.v === v;
  const expect = (v: string) => { if (!isOp(v)) throw new Error(`expected ${v}`); i++; };

  const add = (): Expr => {
    let l = mul();
    while (isOp("+") || isOp("-")) {
      const op = toks[i++].v, a = l, b = mul();
      l = op === "+" ? (e) => a(e) + b(e) : (e) => a(e) - b(e);
    }
    return l;
  };
  const mul = (): Expr => {
    let l = unary();
    for (;;) {
      if (isOp("*") || isOp("/")) {
        const op = toks[i++].v, a = l, b = unary();
        l = op === "*" ? (e) => a(e) * b(e) : (e) => a(e) / b(e);
      } else if (peek() && (peek()!.t !== "op" || isOp("(") || (isOp("|") && bars === 0))) {
        const a = l, b = pow();          // implicit: 2x, 2(x+1), (x-1)(x-2), 2|x|
        l = (e) => a(e) * b(e);
      } else return l;
    }
  };
  const unary = (): Expr => {
    if (isOp("-")) { i++; const a = unary(); return (e) => -a(e); }
    if (isOp("+")) { i++; return unary(); }
    return pow();
  };
  const pow = (): Expr => {
    const base = primary();
    if (!isOp("^")) return base;
    i++;
    const ex = unary();                   // right-assoc, allows 2^-x
    return (e) => Math.pow(base(e), ex(e));
  };
  const primary = (): Expr => {
    const tk = toks[i++];
    if (!tk) throw new Error("unexpected end");
    if (tk.t === "num") return () => tk.v;
    if (tk.t === "op" && tk.v === "(") { const a = add(); expect(")"); return a; }
    if (tk.t === "op" && tk.v === "|") {
      bars++; const a = add(); expect("|"); bars--;
      return (e) => Math.abs(a(e));
    }
    if (tk.t === "id") {
      // Own keys only: a plain-object lookup would also find "constructor", "toString"...
      if (Object.prototype.hasOwnProperty.call(FUNCS, tk.v)) {
        const fn = FUNCS[tk.v], a = isOp("(") ? primary() : pow();
        return (e) => fn(a(e));
      }
      if (Object.prototype.hasOwnProperty.call(CONSTS, tk.v)) { const c = CONSTS[tk.v]; return () => c; }
      if (vars.includes(tk.v)) { const n = tk.v; return (e) => e[n]; }
    }
    throw new Error(`unexpected ${tk.v}`);
  };

  const f = add();
  if (i !== toks.length) throw new Error("trailing input");
  return f;
}

// ---------- Sampling ----------

/**
 * Decide whether the curve must be lifted between two neighbouring samples,
 * i.e. the jump is a vertical asymptote (1/(x-2) near x = 2), not a steep stretch.
 * `ySpan` is the visible height (y max - y min).
 */
function shouldBreak(prev: number, curr: number, ySpan: number): boolean {
  // TODO(human)
  return false;
}

/** y = f(x) as polylines, split wherever the curve is undefined or jumps. */
export function sampleFn(f: Expr, [a, b]: Range, y: Range, n = 480): Pt[][] {
  const span = y[1] - y[0];
  const lo = y[0] - 2 * span, hi = y[1] + 2 * span;    // clamp far-off values, keep the shape
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  let prev: number | null = null;
  for (let k = 0; k <= n; k++) {
    const x = a + ((b - a) * k) / n;
    let v: number;
    try { v = f({ x }); } catch { v = NaN; }
    if (!Number.isFinite(v) || (prev !== null && shouldBreak(prev, v, span))) {
      if (run.length > 1) runs.push(run);
      run = [];
    }
    if (Number.isFinite(v)) run.push([x, Math.min(hi, Math.max(lo, v))]);
    prev = Number.isFinite(v) ? v : null;
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

export function sampleParam(fx: Expr, fy: Expr, [a, b]: Range, n = 360): Pt[][] {
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const t = a + ((b - a) * k) / n;
    let p: Pt;
    try { p = [fx({ t }), fy({ t })]; } catch { p = [NaN, NaN]; }
    if (p.every(Number.isFinite)) run.push(p);
    else { if (run.length > 1) runs.push(run); run = []; }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

// ---------- Spec ----------

const MAX_ITEMS = 40;
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const pt = (v: unknown): v is Pt => Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]);
const range = (v: unknown): v is Range => pt(v) && v[0] < v[1];
const pts = (v: unknown, min: number): v is Pt[] =>
  Array.isArray(v) && v.length >= min && v.length <= 200 && v.every(pt);
const pos = (v: unknown): v is number => num(v) && v > 0 && v < 1e6;
const str = (v: unknown, max = 80) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

function item(raw: Record<string, unknown>): Item | null {
  const common: Common = {
    label: str(raw.label), dash: raw.dash === true,
    color: num(raw.color) ? Math.min(3, Math.max(1, Math.round(raw.color))) : 1,
    at: pt(raw.at) ? raw.at : undefined,
  };
  if (typeof raw.fn === "string")
    return { ...common, kind: "fn", f: compile(raw.fn, ["x"]), domain: range(raw.domain) ? raw.domain : undefined };
  if (Array.isArray(raw.param) && typeof raw.param[0] === "string" && typeof raw.param[1] === "string")
    return { ...common, kind: "param", fx: compile(raw.param[0], ["t"]), fy: compile(raw.param[1], ["t"]),
      t: range(raw.t) ? raw.t : [0, 2 * Math.PI] };
  if (num(raw.vline)) return { ...common, kind: "vline", v: raw.vline, dash: raw.dash !== false };
  if (num(raw.hline)) return { ...common, kind: "hline", v: raw.hline, dash: raw.dash !== false };
  if (pts(raw.line, 2) && raw.line.length === 2) return { ...common, kind: "line", a: raw.line[0], b: raw.line[1] };
  if (pts(raw.segment, 2) && raw.segment.length === 2)
    return { ...common, kind: "segment", a: raw.segment[0], b: raw.segment[1], arrow: raw.arrow === true };
  if (pts(raw.polyline, 2)) return { ...common, kind: "polyline", pts: raw.polyline };
  if (pts(raw.polygon, 3)) return { ...common, kind: "polygon", pts: raw.polygon };
  if (pt(raw.circle) && num(raw.r) && raw.r > 0) return { ...common, kind: "circle", c: raw.circle, r: raw.r };
  if (typeof raw.shade === "string" && num(raw.from) && num(raw.to) && raw.from < raw.to)
    return { ...common, kind: "shade", f: compile(raw.shade, ["x"]), from: raw.from, to: raw.to };
  if (pt(raw.point)) return { ...common, kind: "point", p: raw.point, open: raw.open === true };
  if (pt(raw.text) && common.label) return { ...common, kind: "text", p: raw.text };
  // ---- mechanics / geometry kit ----
  if (pt(raw.force) && num(raw.dir))
    return { ...common, kind: "force", p: raw.force, dir: raw.dir, len: pos(raw.len) ? raw.len : 1.5 };
  if (pt(raw.particle)) return { ...common, kind: "particle", p: raw.particle };
  if (pt(raw.block) || pt(raw.rest)) {
    const w = pos(raw.w) ? raw.w : 1, h = pos(raw.h) ? raw.h : 0.6, rot = num(raw.rot) ? raw.rot : 0;
    // "rest": the point where the block's base touches a surface (e.g. on a slope); the centre
    // is half the height out along that surface's normal, so the block sits flush on it.
    const r = (rot * Math.PI) / 180;
    const c: Pt = pt(raw.block) ? raw.block
      : [(raw.rest as Pt)[0] - (h / 2) * Math.sin(r), (raw.rest as Pt)[1] + (h / 2) * Math.cos(r)];
    return { ...common, kind: "block", c, w, h, rot };
  }
  if (pt(raw.incline) && num(raw.angle) && raw.angle > 0 && raw.angle < 90)
    return { ...common, kind: "incline", p: raw.incline, angle: raw.angle, length: pos(raw.length) ? raw.length : 5 };
  if (pt(raw.pulley)) return { ...common, kind: "pulley", c: raw.pulley, r: pos(raw.r) ? raw.r : 0.4 };
  if (pts(raw.ground, 2) && raw.ground.length === 2) return { ...common, kind: "ground", a: raw.ground[0], b: raw.ground[1] };
  if (pts(raw.angle, 3) && raw.angle.length === 3)
    return { ...common, kind: "angle", a: raw.angle[0], o: raw.angle[1], b: raw.angle[2], right: raw.right === true };
  return null;
}

/** Parse a ```graph block body. Returns null if it is not a usable graph at all. */
export function parseGraph(body: string): GraphSpec | null {
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return null; }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const all: unknown[] = Array.isArray(o.items) ? o.items : [];
  const items: Item[] = [];
  for (const r of all.slice(0, MAX_ITEMS)) {
    if (!r || typeof r !== "object") continue;
    try { const it = item(r as Record<string, unknown>); if (it) items.push(it); } catch { /* bad expression */ }
  }
  if (!items.length) return null;
  const axes = Array.isArray(o.axes) ? o.axes : [];
  const showAxes = o.axes !== false;
  return {
    x: range(o.x) ? o.x : [-5, 5],
    y: range(o.y) ? o.y : [-5, 5],
    axes: [str(axes[0], 12) ?? "x", str(axes[1], 12) ?? "y"],
    showAxes,
    // A diagram without axes is about shapes and angles, so it keeps true proportions
    // unless the model explicitly turns that off.
    equal: o.equal === true || (!showAxes && o.equal !== false),
    title: str(o.title, 120),
    items,
    dropped: all.length - items.length,
  };
}

/** About `count` round tick values covering [a, b]: steps of 1, 2 or 5 x 10^k. */
export function ticks([a, b]: Range, count = 6): number[] {
  const raw = (b - a) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(a / step) * step; v <= b + 1e-9; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : +v.toPrecision(12));
  return out;
}
