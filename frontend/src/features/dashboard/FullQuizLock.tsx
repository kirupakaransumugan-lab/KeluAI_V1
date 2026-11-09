import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../../app/providers";
import { fill } from "../../utils/dates";

/** Shown when a student who is not yet in their exam year presses the home page "Start quiz":
 *  the 10-question full syllabus quiz is for exam-year students (backend services/quiz_plan.py). */
export function FullQuizLock({ examYear, onGo, onClose }: {
  examYear: number | null; onGo: () => void; onClose: () => void;
}) {
  const { t } = useLanguage();
  const c = t.dashboard.home.fullLock;
  const goRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Focus the main action on open and give focus back to whatever opened the dialog on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    goRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab") return;
    // Keep Tab inside the dialog.
    const items = boxRef.current?.querySelectorAll<HTMLElement>("button");
    if (!items?.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  // Portalled to <body>: inside the goal card a transformed or clipped ancestor could trap it.
  return createPortal(
    <div className="db-modal-scrim" onClick={onClose}>
      <div ref={boxRef} className="db-modal" role="dialog" aria-modal="true" aria-labelledby="full-lock-title"
        aria-describedby="full-lock-text" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <img className="db-modal-art" src="/dashboard/bear-cheer.png" alt="" />
        <h2 id="full-lock-title">{c.title}</h2>
        <p id="full-lock-text">{examYear ? fill(c.text, { year: examYear }) : c.textNoYear}</p>
        <div className="db-modal-actions">
          <button type="button" className="db-btn-outline" onClick={onClose}>{c.close}</button>
          <button ref={goRef} type="button" className="db-btn-primary" onClick={onGo}>{c.go}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
