import { useState, type ChangeEvent, type FormEvent } from "react";
import { useLanguage } from "../../app/providers";
import { ApiError, quizzesApi, type FeedbackKind, type QuizQuestion } from "../../services/api";
import { icons } from "../dashboard/icons";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;       // the server checks this too
const MAX_MESSAGE = 2000;

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

/** On a finished question: report a mistake, or share another way to solve it. */
export function FeedbackForm({ question }: { question: QuizQuestion }) {
  const { t } = useLanguage();
  const f = t.dashboard.practice.feedback;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("mistake");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") return <p className="pr-fb-sent" role="status">{icons.check}{f.thanks}</p>;
  if (!open) {
    return <button type="button" className="pr-link pr-fb-open" onClick={() => setOpen(true)}>{f.open}</button>;
  }

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const chosen = e.target.files?.[0] ?? null;
    setError(chosen && chosen.size > MAX_IMAGE_BYTES ? f.errors.tooLarge : null);
    setFile(chosen && chosen.size <= MAX_IMAGE_BYTES ? chosen : null);
    if (chosen && chosen.size > MAX_IMAGE_BYTES) e.target.value = "";
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      const image = file ? await toBase64(file) : null;
      await quizzesApi.sendFeedback(question, kind, message.trim(), image);
      setState("sent");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(code === "too_many_reports" ? f.errors.tooMany
        : code === "image_too_large" ? f.errors.tooLarge
        : code === "bad_image" ? f.errors.badImage : f.errors.failed);
      setState("idle");
    }
  };

  return (
    <form className="pr-fb" onSubmit={send}>
      <div className="pr-fb-kinds" role="radiogroup" aria-label={f.open}>
        {(["mistake", "method"] as const).map((k) => (
          <label key={k} className={`pr-fb-kind${kind === k ? " on" : ""}`}>
            <input type="radio" name={`fb-${question.number}`} checked={kind === k} onChange={() => setKind(k)} />
            {f.kinds[k]}
          </label>
        ))}
      </div>
      <label className="pr-fb-label">
        {kind === "mistake" ? f.mistakeLabel : f.methodLabel}
        <textarea rows={4} maxLength={MAX_MESSAGE} value={message} required onChange={(e) => setMessage(e.target.value)} />
      </label>
      <label className="pr-fb-label">
        {f.photoLabel}
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pick} />
      </label>
      <p className="pr-muted pr-fb-note">{f.photoNote}</p>
      {error && <p className="pr-error" role="alert">{error}</p>}
      <div className="pr-row">
        <button type="submit" className="pr-btn-primary pr-btn-sm" disabled={state === "sending" || !message.trim()}>{f.send}</button>
        <button type="button" className="pr-btn-outline pr-btn-sm" onClick={() => setOpen(false)}>{f.cancel}</button>
      </div>
    </form>
  );
}
