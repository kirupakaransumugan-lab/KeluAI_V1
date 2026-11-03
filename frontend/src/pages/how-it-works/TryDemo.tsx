import { useState } from "react";
import { useLanguage } from "../../app/providers";

export function TryDemo() {
  const { t } = useLanguage();
  const h = t.how;
  const [step, setStep] = useState<number | null>(0);
  const [hintIdx, setHintIdx] = useState(0);
  const [working, setWorking] = useState("");

  const current = step === null ? null : h.demoSteps[step];
  const hasMore = current !== null && hintIdx < current.hints.length - 1;

  function pick(i: number) {
    setStep(i);
    setHintIdx(0);
  }

  function reset() {
    setStep(null);
    setHintIdx(0);
    setWorking("");
  }

  return (
    <div className="try-card">
      <div className="try-question">
        <div className="try-meta">
          <span className="try-meta-label">
            <span aria-hidden="true">▦</span>
            {h.subject}
            <i aria-hidden="true">|</i>
            {h.topic}
          </span>
          <span className="try-marks">{h.marks}</span>
        </div>

        <div className="try-math">
          <p>
            {h.questionIntro} <em>f</em>(<em>x</em>) = 3<em>x</em><sup>2</sup> − 4<em>x</em> + 5,
          </p>
          <p><span className="part">(a)</span> {h.partA} <em>f</em>′(<em>x</em>),</p>
          <p><span className="part">(b)</span> {h.partB}</p>
        </div>

        <label className="try-working">
          <span>{h.workingLabel}</span>
          <textarea
            value={working}
            onChange={(e) => setWorking(e.target.value)}
            placeholder={h.workingPlaceholder}
            rows={4}
          />
        </label>

        <div className="try-actions">
          <button type="button" className="try-reset" onClick={reset}>{h.reset}</button>
          <button type="button" className="try-check" disabled={working.trim() === ""}>
            ✓ {h.check}
          </button>
        </div>
      </div>

      <div className="try-hints">
        <h3><span aria-hidden="true">💡</span> {h.chooseStep}</h3>
        <p className="try-hints-sub">{h.chooseStepSub}</p>

        <ol className="step-list">
          {h.demoSteps.map((s, i) => (
            <li key={s.label}>
              <button
                type="button"
                className={step === i ? "step-btn selected" : "step-btn"}
                aria-pressed={step === i}
                onClick={() => pick(i)}
              >
                <span className="step-num">{i + 1}</span>
                <span className="step-label">{s.label}</span>
                <span className="step-chev" aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="hint-box" aria-live="polite">
          {current === null || step === null ? (
            <p className="hint-empty">{h.noHintYet}</p>
          ) : (
            <>
              <strong>{h.hintFor} {step + 1}</strong>
              <p>{current.hints[hintIdx]}</p>
              {step === 0 && hintIdx === 0 && (
                <div className="hint-formula">
                  <span className="frac"><span>d</span><span>d<em>x</em></span></span>
                  <span>(<em>x</em><sup><em>n</em></sup>) = <em>nx</em><sup><em>n</em>−1</sup></span>
                </div>
              )}
            </>
          )}
          {hasMore && (
            <button type="button" className="next-hint" onClick={() => setHintIdx((n) => n + 1)}>
              {h.nextHint} →
            </button>
          )}
          <img className="hint-bear" src="/how-it-works/bear-cheer.png" alt="" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
