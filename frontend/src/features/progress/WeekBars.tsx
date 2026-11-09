import { useLanguage } from "../../app/providers";
import type { ProgressWeek } from "../../services/api";
import { fill } from "../../utils/dates";

// Average score by week. One series, so no legend (the card title names it): this week in full
// plum, earlier weeks lighter, each bar labelled, and a tooltip on hover or keyboard focus.
// A week with no practice has no bar and a dash: it wasn't a score of 0.
const TICKS = [100, 75, 50, 25, 0];

export function WeekBars({ weeks }: { weeks: ProgressWeek[] }) {
  const { t } = useLanguage();
  const c = t.dashboard.progress;
  return (
    <div className="pg-bars">
      <div className="pg-bars-axis" aria-hidden="true">{TICKS.map((v) => <span key={v}>{v}</span>)}</div>
      <div className="pg-bars-plot">
        <div className="pg-grid-layer" aria-hidden="true">
          {TICKS.map((v) => <i key={v} style={{ bottom: `${v}%` }} />)}
        </div>
        {weeks.map((w, i) => {
          const current = i === weeks.length - 1;
          const label = current ? c.thisWeek : fill(c.weekLabel, { n: i + 1 });
          const detail = w.score === null ? c.noPractice : fill(c.weekDetail, { pct: w.score, n: w.questions });
          return (
            <div key={w.start} className="pg-col" tabIndex={0} role="img" aria-label={`${label}: ${detail}`}>
              <div className="pg-col-plot">
                {w.score === null
                  ? <span className="pg-val pg-val-none" style={{ bottom: 0 }}>–</span>
                  : <span className="pg-val" style={{ bottom: `${w.score}%` }}>{w.score}%</span>}
                {w.score !== null && <span className={`pg-bar${current ? " current" : ""}`} style={{ height: `${w.score}%` }} />}
                <span className="pg-tip" role="presentation">{detail}</span>
              </div>
              <span className="pg-col-label">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
