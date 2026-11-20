import { useEffect, useRef, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import "../../styles/welcome.css";

// Shown over the dashboard once a student's trial (or paid plan) has ended. It can't be closed:
// the server answers 402 plan_ended to every study feature, so the only ways out are to
// subscribe or log out. The subscription page itself stays open (the layout skips this card there).
export function PlanEndedModal({ onLogout }: { onLogout: () => void }) {
  const { t } = useLanguage();
  const p = t.dashboard.planEnded;
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const goRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    goRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Keep Tab inside the card; Escape does nothing because there is nothing to go back to.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Tab") return;
    const items = boxRef.current?.querySelectorAll<HTMLElement>("button");
    if (!items?.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return createPortal(
    <div className="wl-scrim">
      <div ref={boxRef} className="wl-modal" role="alertdialog" aria-modal="true"
        aria-labelledby="pe-title" aria-describedby="pe-text" onKeyDown={onKeyDown}>
        <img className="wl-bear" src="/dashboard/bear-cheer.png" alt="" aria-hidden="true" />
        <div className="wl-body">
          <h2 id="pe-title">{p.title}</h2>
          <p id="pe-text" className="wl-sub">{p.text}</p>
          <div className="wl-actions">
            <button ref={goRef} type="button" className="db-btn-primary wl-go"
              onClick={() => navigate("/dashboard/subscription")}>{p.subscribe}</button>
            <button type="button" className="wl-skip" onClick={onLogout}>{p.logout}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
