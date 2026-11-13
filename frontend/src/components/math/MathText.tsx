import katex from "katex";
import "katex/dist/katex.min.css";
import { Fragment, useMemo, type ReactNode } from "react";
import { Graph } from "./Graph";

// Tutor replies are plain text with LaTeX ($...$, $$...$$, \(...\), \[...\]), **bold**
// and [S1]-style citations. Newlines are kept by the container's white-space: pre-line.
const TOKEN = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$|\*\*[^*\n]+\*\*|\[S\d+\])/g;

function tex(src: string, display: boolean, key: number): ReactNode {
  // throwOnError: false shows a bad formula in red instead of crashing the chat.
  const html = katex.renderToString(src, { displayMode: display, throwOnError: false, output: "html" });
  return <span key={key} className={display ? "mt-display" : undefined} dangerouslySetInnerHTML={{ __html: html }} />;
}

function render(text: string): ReactNode[] {
  return text.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    if (part.startsWith("$$")) return tex(part.slice(2, -2), true, i);
    if (part.startsWith("\\[")) return tex(part.slice(2, -2), true, i);
    if (part.startsWith("\\(")) return tex(part.slice(2, -2), false, i);
    if (part.startsWith("$")) return tex(part.slice(1, -1), false, i);
    if (part.startsWith("**")) return <strong key={i}>{render(part.slice(2, -2))}</strong>;
    return <sup key={i} className="mt-cite">{part.slice(1, -1)}</sup>;
  });
}

// Reply layout from backend/app/rag/agent/prompts.py (FORMAT): "###" sections
// Given / Key idea / Steps / Answer / Check (or the Tamil names); Answer and Check become cards.
const HEADING = /^#{2,4}\s+(.+?)\s*#*$/;
const BULLET = /^\s*[-*•]\s+([\s\S]*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+([\s\S]*)$/;
const CARD = /^(answer|check|final answer|விடை|சரிபார்ப்பு)$/i;
const AI_NOTE = /^\**AI[-\s]/;                     // "AI-solved – ..." disclaimer (papers-first rule)
const YOUR_TURN = /^\*\*(your turn|உங்கள் முறை)/i;
const FENCE = /^\s*```/;                            // ```graph {json} ``` (see Graph.tsx)

/** Lines, but a display-maths block or a ``` fence that spans several lines stays one line. */
function logicalLines(text: string): string[] {
  const out: string[] = [];
  let buf: string | null = null;
  let fence = false;
  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    if (fence) {
      buf += `\n${line}`;
      if (FENCE.test(line)) { out.push(buf!); buf = null; fence = false; }
      continue;
    }
    if (buf === null && FENCE.test(line)) { buf = line; fence = true; continue; }
    buf = buf === null ? line : `${buf}\n${line}`;
    const openDollar = (buf.match(/\$\$/g) ?? []).length % 2 === 1;
    const openBracket = (buf.match(/\\\[/g) ?? []).length > (buf.match(/\\\]/g) ?? []).length;
    if (!openDollar && !openBracket) { out.push(buf); buf = null; }
  }
  if (buf !== null) out.push(buf);
  return out;
}

type Block = { kind: "p" | "ul" | "ol" | "graph" | "code"; items: string[]; start?: number };

function toBlocks(lines: string[]): Block[] {
  const out: Block[] = [];
  let gap = false;
  for (const line of lines) {
    if (!line.trim()) { gap = true; continue; }
    if (FENCE.test(line)) {
      // Checked before list items, so a fence indented under a step still becomes its own block.
      const [open, ...rest] = line.split("\n");
      if (rest.length && FENCE.test(rest[rest.length - 1])) rest.pop();
      out.push({ kind: /^\s*```\s*graph\b/i.test(open) ? "graph" : "code", items: [rest.join("\n")] });
      gap = false;
      continue;
    }
    const last = out[out.length - 1];
    const b = BULLET.exec(line);
    const n = b ? null : NUMBERED.exec(line);
    if (b || n) {
      const kind = b ? "ul" : "ol";
      const item = b ? b[1] : n![2];
      if (last?.kind === kind) last.items.push(item);
      else out.push({ kind, items: [item], start: n ? Number(n[1]) : undefined });
    } else if (last && last.kind !== "p" && (/^\s+\S/.test(line) || /^\s*(\$\$|\\\[)/.test(line))) {
      // Working under a numbered step (indented, or a display block) belongs to that step.
      last.items[last.items.length - 1] += `\n${line.trim()}`;
    } else if (last?.kind === "p" && !gap) {
      last.items.push(line);
    } else {
      out.push({ kind: "p", items: [line] });
    }
    gap = false;
  }
  return out;
}

function renderBlock(block: Block, key: number): ReactNode {
  if (block.kind === "graph") return <Graph key={key} source={block.items[0]} />;
  if (block.kind === "code") return <pre key={key} className="mt-code">{block.items[0]}</pre>;
  if (block.kind === "p") {
    const text = block.items.join("\n");
    const cls = AI_NOTE.test(text) ? "mt-note" : YOUR_TURN.test(text) ? "mt-turn" : undefined;
    return <p key={key} className={cls}>{render(text)}</p>;
  }
  const items = block.items.map((item, i) => <li key={i}>{render(item)}</li>);
  return block.kind === "ul"
    ? <ul key={key}>{items}</ul>
    : <ol key={key} start={block.start}>{items}</ol>;
}

function layout(text: string): ReactNode[] {
  const sections: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];
  for (const line of logicalLines(text)) {
    const h = HEADING.exec(line);
    if (h) sections.push({ title: h[1].replace(/\*\*/g, "").trim(), lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  return sections.map((s, i) => {
    const body = toBlocks(s.lines).map(renderBlock);
    if (!s.title) return <Fragment key={i}>{body}</Fragment>;
    const card = CARD.test(s.title);
    return (
      <section key={i} className={`mt-sec${card ? " mt-card" : ""}`}>
        <h4 className="mt-h">{render(s.title)}</h4>
        {body}
      </section>
    );
  });
}

// A model sometimes writes "\begin{aligned} ... \end{aligned}" with no $$ around it, which
// would show as raw LaTeX. Text with no delimiters at all gets its environments wrapped.
// (Quizzes saved in the browser before the backend fix need this too.)
const BARE_ENV = /\\begin\{(\w+\*?)\}[\s\S]*?\\end\{\1\}/g;

function withDelimiters(text: string): string {
  if (/\$|\\\[|\\\(/.test(text)) return text;
  return text.replace(BARE_ENV, (env) => `$$${env}$$`);
}

// Text copied from a JSON file, a chat app or some editors arrives "escaped twice":
// "\\(x\\)" instead of "\(x\)". Then the maths can't be found and KaTeX shows it in red.
// Only when the text uses doubled delimiters and no normal ones, halve every "\\".
const DOUBLED = /\\\\[([]/;
const SINGLE = /(^|[^\\])\\[([]/;

export function unescapeDoubled(text: string): string {
  return DOUBLED.test(text) && !SINGLE.test(text) ? text.replace(/\\\\/g, "\\") : text;
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const nodes = useMemo(() => layout(withDelimiters(unescapeDoubled(text))), [text]);
  return <div className={`mt-text${className ? ` ${className}` : ""}`}>{nodes}</div>;
}

/** Text for speech synthesis: maths markup stripped so it isn't read out symbol by symbol. */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?(```|$)/g, " ")
    .replace(/\[S\d+\]/g, "")
    .replace(/\\(frac|dfrac)\{([^}]*)\}\{([^}]*)\}/g, "$2 over $3")
    .replace(/\\int/g, " integral of ").replace(/\\sum/g, " sum of ")
    .replace(/[$*{}\\^_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
