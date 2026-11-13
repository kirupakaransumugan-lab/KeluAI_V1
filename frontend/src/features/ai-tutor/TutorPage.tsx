import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useOutletContext, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../app/providers";
import { MathText, speakable, unescapeDoubled } from "../../components/math/MathText";
import type { DashboardContext } from "../../layouts/DashboardLayout";
import { ApiError, tutorApi, type ChatTurn, type TutorSource } from "../../services/api";
import { fill } from "../../utils/dates";
import { icons } from "../dashboard/icons";
import {
  DAILY_LIMIT, GROUP_ORDER, MAX_HINT_LEVEL, groupFor, loadConversations, newId, saveConversations,
  sentToday, titleFrom, type Conversation, type Group, type Message,
} from "./conversations";
import { ACCEPTED, AttachError, imageFrom, prepareImage, type Attachment } from "./imageAttach";
import { useChatSync } from "./useChatSync";
import "../../styles/tutor.css";

const MAX_TURN_CHARS = 8000;     // backend Turn.content limit

// Web Speech API: not in the TS DOM lib, and Chrome still ships it prefixed.
interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
const SpeechRecognitionCtor = (window as unknown as {
  SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition;
}).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;
const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

/** The image itself goes only with the turn it was attached to; later turns carry `imageNote`
 *  instead, and the tutor's reply already described what the image showed. */
const toHistory = (messages: Message[], imageNote: string): ChatTurn[] =>
  messages.filter((m) => !m.error && (m.content || m.image))
    .map((m) => ({ role: m.role, content: (m.image ? `${imageNote}\n${m.content}` : m.content).slice(0, MAX_TURN_CHARS) }));

function sourceLabel(s: TutorSource): string {
  const kind = s.upload_type === "marking_scheme" ? "Marking scheme" : s.upload_type === "past_paper" ? "Past paper" : s.title;
  const head = [kind, s.exam_year].filter(Boolean).join(" ");
  return s.question_number ? `${head}, Q${s.question_number}` : head;
}

export function TutorPage() {
  const { user } = useOutletContext<DashboardContext>();
  const { lang, setLang, t } = useLanguage();
  const tt = t.dashboard.tutor;
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const locale = lang === "ta" ? "ta-LK" : "en-LK";

  const [initial] = useState(() => loadConversations(user.id));
  const [chats, setChats] = useState<Conversation[]>(initial);
  const [activeId, setActiveId] = useState<string | null>(() => mostRecent(initial)?.id ?? null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [chatsOpen, setChatsOpen] = useState(false);       // mobile chat list
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);   // chat waiting for "Delete?" confirm
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const handledQ = useRef(false);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const used = sentToday(chats);
  const limitReached = used >= DAILY_LIMIT;

  useEffect(() => saveConversations(user.id, chats), [chats, user.id]);   // browser cache
  useChatSync(user.id, chats, setChats);                                    // the server copy

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [active?.messages.length, pendingId, activeId]);

  // Stop speech when leaving the page.
  useEffect(() => () => {
    if (canSpeak) window.speechSynthesis.cancel();
    recognition.current?.stop();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const updateChat = (id: string, fn: (c: Conversation) => Conversation) =>
    setChats((list) => list.map((c) => (c.id === id ? fn(c) : c)));

  const appendReply = (id: string, msg: Omit<Message, "id" | "role" | "at">) =>
    updateChat(id, (c) => ({
      ...c, updatedAt: Date.now(),
      messages: [...c.messages, { id: newId(), role: "assistant", at: Date.now(), ...msg }],
    }));

  async function requestReply(convId: string, history: ChatTurn[], hintLevel: number, image?: string) {
    setPendingId(convId);
    if (image) retryImage.current[convId] = image;          // kept in memory so "Try again" resends it
    try {
      const r = await tutorApi.chat(history, lang, hintLevel, "practice", image);
      delete retryImage.current[convId];
      appendReply(convId, {
        content: r.truncated ? `${r.content}\n\n${tt.truncated}` : r.content,
        sources: r.sources, hintLevel: r.hint_level,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        navigate("/login", { replace: true });
        return;
      }
      appendReply(convId, { content: "", error: err instanceof ApiError ? err.code ?? "tutor_failed" : "network" });
    } finally {
      setPendingId(null);
    }
  }

  async function send(text: string, opts: { hintLevel?: number; fresh?: boolean; withImage?: boolean } = {}) {
    const image = opts.withImage ? attachment : null;
    const body = unescapeDoubled(text.trim()) || (image ? tt.image.onlyMessage : "");
    if (!body || pendingId || limitReached) return;
    const now = Date.now();
    const base: Conversation = (!opts.fresh && active) || {
      id: newId(), title: titleFrom(body), createdAt: now, updatedAt: now, saved: false, hintLevel: 0, messages: [],
    };
    const hintLevel = opts.hintLevel ?? base.hintLevel;
    const next: Conversation = {
      ...base, hintLevel, updatedAt: now,
      messages: [...base.messages, { id: newId(), role: "user", content: body, at: now, image: image?.thumb }],
    };
    setChats((list) => [next, ...list.filter((c) => c.id !== next.id)]);
    setActiveId(next.id);
    setDraft("");
    setAttachment(null);
    if (inputRef.current) inputRef.current.style.height = "";
    // The newest turn is sent without the note: it carries the image itself.
    const history = toHistory(next.messages, tt.image.historyNote);
    if (image) history[history.length - 1] = { role: "user", content: body };
    await requestReply(next.id, history, hintLevel, image?.full);
  }

  // ---------- Attaching an image (button, paste or drop) ----------
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const retryImage = useRef<Record<string, string>>({});

  const attach = async (file: File | null | undefined) => {
    if (!file) return;
    setAttachError(null);
    try {
      setAttachment(await prepareImage(file));
      inputRef.current?.focus();
    } catch (err) {
      const code = err instanceof AttachError ? err.code : "bad_image";
      setAttachError(code === "image_too_large" ? tt.errors.imageTooLarge : tt.errors.badImage);
    }
  };

  // Question typed on the dashboard home ask bar arrives as ?q=; start a fresh chat with it.
  useEffect(() => {
    const q = params.get("q");
    if (!q || handledQ.current) return;
    handledQ.current = true;
    setParams({}, { replace: true });
    void send(q, { fresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = (c: Conversation) => {
    const messages = c.messages.filter((m) => !m.error);
    updateChat(c.id, (x) => ({ ...x, messages }));
    const image = retryImage.current[c.id];
    const history = toHistory(messages, tt.image.historyNote);
    const last = messages[messages.length - 1];
    if (image && last?.role === "user") history[history.length - 1] = { role: "user", content: last.content };
    void requestReply(c.id, history, c.hintLevel, image);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft, { withImage: true });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft, { withImage: true });
    }
  };

  const autosize = (el: HTMLTextAreaElement) => {
    el.style.height = "";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const prefill = (text: string) => {
    setDraft(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      const caret = text.indexOf("  ") + 1 || text.length;    // between the two spaces
      el.setSelectionRange(caret, caret);
    });
  };

  const newChat = () => {
    setActiveId(null);
    setChatsOpen(false);
    setDraft("");
    inputRef.current?.focus();
  };

  const askDelete = (id: string) => {
    setDeleteId(id);
    setMenuOpen(false);
  };

  const deleteChat = (id: string) => {
    setChats((list) => list.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    setDeleteId(null);
  };
  const deleting = chats.find((c) => c.id === deleteId) ?? null;

  const listen = (m: Message) => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    if (speakingId === m.id) {
      setSpeakingId(null);
      return;
    }
    const words = speakable(m.content);
    const u = new SpeechSynthesisUtterance(words);
    // The voice follows the reply's language (a Tamil question gets a Tamil answer even in the
    // English app), counting Tamil letters against English ones.
    const tamil = (words.match(/[஀-௿]/g) ?? []).length;
    const latin = (words.match(/[A-Za-z]/g) ?? []).length;
    u.lang = tamil > latin * 0.3 ? "ta-IN" : "en-GB";
    u.onend = u.onerror = () => setSpeakingId((cur) => (cur === m.id ? null : cur));
    setSpeakingId(m.id);
    window.speechSynthesis.speak(u);
  };

  const toggleVoice = () => {
    if (!SpeechRecognitionCtor) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new SpeechRecognitionCtor();
    r.lang = lang === "ta" ? "ta-LK" : "en-LK";
    r.interimResults = false;
    r.onresult = (e) => {
      const said = Array.from(e.results).map((res) => res[0].transcript).join(" ");
      setDraft((d) => (d ? `${d} ${said}` : said));
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };

  // ---------- Sidebar list ----------
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...chats]
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    const now = new Date();
    const groups = new Map<Group, Conversation[]>();
    for (const c of list) {
      const g = groupFor(c.updatedAt, now);
      groups.set(g, [...(groups.get(g) ?? []), c]);
    }
    return GROUP_ORDER.filter((g) => groups.has(g)).map((g) => [g, groups.get(g)!] as const);
  }, [chats, query]);

  const timeLabel = (ts: number, g: Group) =>
    g === "today" || g === "yesterday"
      ? new Date(ts).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
      : new Date(ts).toLocaleDateString(locale, g === "week" ? { weekday: "short" } : { day: "numeric", month: "short" });

  const clock = (ts: number) => new Date(ts).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  const errorText = (code: string) =>
    code === "tutor_not_configured" ? tt.errors.notConfigured : code === "network" ? tt.errors.network
      : code === "bad_image" ? tt.errors.badImage : code === "image_too_large" ? tt.errors.imageTooLarge : tt.errors.failed;

  const lastReply = active?.messages[active.messages.length - 1];
  const showChips = !!lastReply && lastReply.role === "assistant" && !lastReply.error && pendingId !== active?.id;

  return (
    <main className={`tu-page${chatsOpen ? " chats-open" : ""}`}>
      {/* ---------- Conversations ---------- */}
      <aside className="tu-chats" aria-label={tt.toggleChats}>
        <button type="button" className="tu-new" onClick={newChat}>{icons.plus}{tt.newChat}</button>
        <label className="tu-search">
          {icons.search}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={tt.search} aria-label={tt.search} />
        </label>

        <div className="tu-chat-list">
          {grouped.length === 0 && <p className="tu-chat-empty">{query ? tt.noMatches : tt.noChats}</p>}
          {grouped.map(([g, list]) => (
            <section key={g}>
              <h3>{tt.groups[g]}</h3>
              {list.map((c) => (
                // Row wrapper: the delete button can't sit inside the chat button (no nested buttons).
                <div key={c.id} className="tu-chat-row">
                  <button type="button" className={`tu-chat${c.id === activeId ? " active" : ""}`}
                    aria-current={c.id === activeId ? "true" : undefined}
                    onClick={() => { setActiveId(c.id); setChatsOpen(false); }}>
                    <span className="tu-chat-icon">{c.saved ? icons.doc : icons.question}</span>
                    <span className="tu-chat-copy">
                      <strong>{c.title}</strong>
                      <span>{c.saved ? tt.savedQuestion : fill(tt.messages, { n: c.messages.length })}</span>
                    </span>
                    <time>{timeLabel(c.updatedAt, g)}</time>
                  </button>
                  <button type="button" className="tu-chat-del" aria-label={`${tt.deleteChat}: ${c.title}`}
                    title={tt.deleteChat} onClick={() => askDelete(c.id)}>
                    {icons.trash}
                  </button>
                </div>
              ))}
            </section>
          ))}
        </div>

        <div className="tu-banner">
          <img src="/dashboard/tutor-banner.png" alt={`${tt.bannerTitle} ${tt.bannerText}`} />
        </div>
      </aside>
      {chatsOpen && <div className="tu-scrim" onClick={() => setChatsOpen(false)} aria-hidden="true" />}

      {deleting && (
        <div className="tu-confirm-scrim" onClick={() => setDeleteId(null)}>
          <div className="tu-confirm" role="alertdialog" aria-modal="true" aria-labelledby="tu-confirm-title"
            onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === "Escape" && setDeleteId(null)}>
            <h2 id="tu-confirm-title">{tt.deleteTitle}</h2>
            <p>{fill(tt.deleteText, { title: deleting.title })}</p>
            <div className="tu-confirm-actions">
              <button type="button" className="tu-confirm-cancel" autoFocus onClick={() => setDeleteId(null)}>{tt.cancel}</button>
              <button type="button" className="tu-confirm-delete" onClick={() => deleteChat(deleting.id)}>
                {icons.trash}{tt.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Conversation ---------- */}
      <section className="tu-conv">
        <header className="tu-head">
          <button type="button" className="tu-head-icon" aria-label={tt.toggleChats}
            aria-expanded={chatsOpen} onClick={() => setChatsOpen((o) => !o)}>
            {icons.panel}
          </button>
          <div className="tu-head-copy">
            <div className="tu-head-title">
              <h1>{active?.title ?? tt.untitled}</h1>
              {active && (
                <button type="button" className={`tu-save${active.saved ? " on" : ""}`}
                  aria-pressed={active.saved} aria-label={active.saved ? tt.unsave : tt.save}
                  title={active.saved ? tt.unsave : tt.save}
                  onClick={() => updateChat(active.id, (c) => ({ ...c, saved: !c.saved, updatedAt: Date.now() }))}>
                  {active.saved ? icons.bookmarkFilled : icons.bookmark}
                </button>
              )}
            </div>
            <span className="tu-chip">{icons.doc}{tt.modeChip}</span>
          </div>
          <label className="tu-lang">
            {icons.globe}
            <select value={lang} onChange={(e) => setLang(e.target.value as "en" | "ta")} aria-label={t.nav.language}>
              <option value="en">English</option>
              <option value="ta">தமிழ்</option>
            </select>
            {icons.chevronDown}
          </label>
          {active && (
            <div className="tu-menu" ref={menuRef}>
              <button type="button" className="db-icon-btn" aria-label={tt.more} aria-haspopup="menu"
                aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
                {icons.dots}
              </button>
              {menuOpen && (
                <div className="tu-menu-pop" role="menu">
                  <button type="button" role="menuitem" onClick={() => askDelete(active.id)}>
                    {icons.trash}{tt.deleteChat}
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        <div className="tu-thread" aria-live="polite">
          {!active && (
            <div className="tu-welcome">
              <img src="/dashboard/bear-avatar.png" alt="" />
              <h2>{tt.welcomeTitle}</h2>
              <p>{tt.welcomeText}</p>
              <div className="tu-chips">
                {tt.starters.map((s) => (
                  <button key={s} type="button" className="tu-suggest" disabled={limitReached}
                    onClick={() => void send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {active?.messages.map((m, i) => {
            if (m.role === "user") {
              return (
                <div key={m.id} className="tu-row tu-row-user">
                  <div className="tu-user-wrap">
                    <div className="tu-user-stack">
                      {m.image && <img className="tu-user-image" src={m.image} alt={tt.image.alt} />}
                      <MathText className="tu-bubble-user" text={m.content} />
                    </div>
                    <span className="tu-meta">{clock(m.at)} <span className="tu-ticks">{icons.checks}</span></span>
                  </div>
                  <span className="tu-avatar-user" aria-label={tt.you}>{user.full_name.trim().charAt(0).toUpperCase()}</span>
                </div>
              );
            }
            const prev = active.messages.slice(0, i).reverse().find((x) => x.role === "assistant" && !x.error);
            const showHint = m.hintLevel !== undefined && (!prev || prev.hintLevel !== m.hintLevel);
            return (
              <div key={m.id} className="tu-row">
                <img className="tu-avatar-bot" src="/dashboard/bear-avatar.png" alt="KELU" />
                <article className={`tu-bubble-bot${m.error ? " error" : ""}`}>
                  {m.error ? (
                    <>
                      <p>{errorText(m.error)}</p>
                      <button type="button" className="tu-pill" onClick={() => retry(active)} disabled={!!pendingId}>
                        {tt.retry}
                      </button>
                    </>
                  ) : (
                    <>
                      {showHint && (
                        <span className="tu-hint">{fill(tt.hint, { n: m.hintLevel! + 1, max: MAX_HINT_LEVEL + 1 })}</span>
                      )}
                      <MathText text={m.content} />
                      <div className="tu-bot-foot">
                        {m.sources?.map((s) => (
                          <span key={s.label} className="tu-source" title={s.title}>
                            {icons.doc}<span><sup>{s.label}</sup> {sourceLabel(s)}</span>
                          </span>
                        ))}
                        {canSpeak && (
                          <button type="button" className="tu-pill" onClick={() => listen(m)}>
                            {speakingId === m.id ? icons.stop : icons.play}
                            {speakingId === m.id ? tt.stop : tt.listen}
                          </button>
                        )}
                        <time className="tu-meta">{clock(m.at)}</time>
                      </div>
                    </>
                  )}
                </article>
              </div>
            );
          })}

          {showChips && (
            <div className="tu-chips tu-chips-reply">
              {active!.hintLevel < MAX_HINT_LEVEL && (
                <button type="button" className="tu-suggest" disabled={limitReached}
                  onClick={() => void send(tt.nextHintMessage, { hintLevel: active!.hintLevel + 1 })}>
                  {tt.nextHint}
                </button>
              )}
              <button type="button" className="tu-suggest" onClick={() => prefill(tt.iThinkPrefill)}>{tt.iThink}</button>
              <button type="button" className="tu-suggest" disabled={limitReached}
                onClick={() => void send(tt.similarMessage)}>{tt.similar}</button>
            </div>
          )}

          {pendingId && pendingId === active?.id && (
            <div className="tu-row">
              <img className="tu-avatar-bot" src="/dashboard/bear-avatar.png" alt="" />
              <div className="tu-bubble-bot tu-typing" role="status">
                <span className="tu-dots" aria-hidden="true"><i /><i /><i /></span>{tt.thinking}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {(attachment || attachError) && (
          <div className="tu-attach-bar">
            {attachment && (
              <span className="tu-attach-chip">
                <img src={attachment.thumb} alt={tt.image.alt} />
                <span>{attachment.name}</span>
                <button type="button" onClick={() => setAttachment(null)} aria-label={tt.image.remove} title={tt.image.remove}>×</button>
              </span>
            )}
            {attachError && <span className="tu-attach-error" role="alert">{attachError}</span>}
          </div>
        )}
        <form className={`tu-composer${dragging ? " dragging" : ""}`} onSubmit={onSubmit}
          onDragOver={(e) => { if (imageFrom(e.dataTransfer?.items) || e.dataTransfer?.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void attach(e.dataTransfer?.files?.[0]); }}
          aria-label={dragging ? tt.image.dropHere : undefined}>
          <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} hidden
            onChange={(e) => { void attach(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" className={`tu-tool${attachment ? " on" : ""}`} aria-label={tt.attach} title={tt.attach}
            disabled={limitReached || !!pendingId} onClick={() => fileRef.current?.click()}>
            {icons.clip}
          </button>
          <textarea ref={inputRef} rows={1} value={draft} maxLength={MAX_TURN_CHARS}
            placeholder={limitReached ? fill(tt.limitReached, { max: DAILY_LIMIT }) : tt.placeholder}
            aria-label={tt.placeholder} disabled={limitReached}
            onPaste={(e) => { const f = imageFrom(e.clipboardData?.items); if (f) { e.preventDefault(); void attach(f); } }}
            onChange={(e) => { setDraft(e.target.value); autosize(e.target); }} onKeyDown={onKeyDown} />
          {SpeechRecognitionCtor && (
            <button type="button" className={`tu-mic${listening ? " on" : ""}`} onClick={toggleVoice}
              aria-label={listening ? tt.voiceStop : tt.voice} aria-pressed={listening} disabled={limitReached}>
              {icons.mic}
            </button>
          )}
          <button type="submit" className="tu-send" aria-label={tt.send}
            disabled={(!draft.trim() && !attachment) || !!pendingId || limitReached}>
            {icons.send}
          </button>
        </form>
        <footer className="tu-foot">
          <span><span className="db-amber">{icons.sparkle}</span>{fill(tt.usage, { n: Math.min(used, DAILY_LIMIT), max: DAILY_LIMIT })}</span>
          <span>{tt.disclaimer}</span>
        </footer>
      </section>
    </main>
  );
}

function mostRecent(list: Conversation[]): Conversation | undefined {
  return list.reduce<Conversation | undefined>((best, c) => (!best || c.updatedAt > best.updatedAt ? c : best), undefined);
}
