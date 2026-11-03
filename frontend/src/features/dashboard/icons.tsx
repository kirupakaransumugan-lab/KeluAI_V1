// Line icons for the dashboard (24x24, stroke = currentColor), inline so no icon library is needed.
import type { ReactNode } from "react";

function Icon({ children, size = 22 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const icons = {
  menu: <Icon><path d="M4 7h16M4 12h16M4 17h16" /></Icon>,
  home: <Icon><path d="M4 11.5 12 4l8 7.5V20h-5v-5H9v5H4z" fill="currentColor" stroke="none" /></Icon>,
  pencil: <Icon><path d="M15.5 5.5l3 3L8 19H5v-3z" /><path d="M13.5 7.5l3 3" /></Icon>,
  chat: <Icon><path d="M4 12a8 7 0 1 1 3.5 5.8L4 19l1-3.2A6.8 6.8 0 0 1 4 12z" /><path d="M9 12h.01M12 12h.01M15 12h.01" /></Icon>,
  paper: <Icon><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></Icon>,
  chart: <Icon><path d="M5 20v-6M10 20V9M15 20v-9M20 20V5" /></Icon>,
  bookmark: <Icon><path d="M7 4h10v16l-5-4-5 4z" /></Icon>,
  crown: <Icon><path d="M4 8l4 4 4-6 4 6 4-4-2 10H6z" /></Icon>,
  gear: <Icon><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.5a7 7 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.5a7 7 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z" /></Icon>,
  logout: <Icon><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></Icon>,
  search: <Icon><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Icon>,
  bell: <Icon><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></Icon>,
  chevronDown: <Icon size={18}><path d="M6 9l6 6 6-6" /></Icon>,
  arrowRight: <Icon size={18}><path d="M5 12h14M13 6l6 6-6 6" /></Icon>,
  arrowUpRight: <Icon size={24}><path d="M7 17L17 7M9 7h8v8" /></Icon>,
  calendar: <Icon size={26}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16M9 15l2 2 4-4" /></Icon>,
  clock: <Icon size={20}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></Icon>,
  book: <Icon size={28}><path d="M3 6c3-1.5 6-1.5 9 0v13c-3-1.5-6-1.5-9 0zM21 6c-3-1.5-6-1.5-9 0v13c3-1.5 6-1.5 9 0z" /></Icon>,
  target: <Icon size={28}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></Icon>,
  history: <Icon size={26}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>,
  bars: <Icon size={26}><path d="M5 20v-5M10 20V10M15 20v-7M20 20V4" strokeWidth="3.2" /></Icon>,
  sparkle: <Icon size={24}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" fill="currentColor" stroke="none" /></Icon>,
  mic: <Icon size={24}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></Icon>,
  clip: <Icon size={24}><path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 6.9" /></Icon>,
  plus: <Icon size={22}><path d="M12 5v14M5 12h14" /></Icon>,
  send: <Icon size={24}><path d="M21 3L10 14M21 3l-7 18-4-7-7-4z" /></Icon>,
  globe: <Icon size={20}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.4 2.6 3.5 5.4 3.5 8.5s-1.1 5.9-3.5 8.5c-2.4-2.6-3.5-5.4-3.5-8.5s1.1-5.9 3.5-8.5z" /></Icon>,
  dots: <Icon size={22}><circle cx="12" cy="5.5" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="18.5" r="1" fill="currentColor" /></Icon>,
  play: <Icon size={14}><path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor" /></Icon>,
  stop: <Icon size={14}><rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" /></Icon>,
  doc: <Icon size={20}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></Icon>,
  question: <Icon size={20}><circle cx="12" cy="12" r="8.5" /><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.7M12 17h.01" /></Icon>,
  checks: <Icon size={16}><path d="M2 12.5l4 4 8-9M10 15.5l1 1 8-9" /></Icon>,
  panel: <Icon size={20}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M10 4v16" /></Icon>,
  trash: <Icon size={18}><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" /></Icon>,
  bookmarkFilled: <Icon><path d="M7 4h10v16l-5-4-5 4z" fill="currentColor" /></Icon>,
  grid: <Icon size={22}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></Icon>,
  layers: <Icon size={22}><path d="M12 4l9 4.5-9 4.5-9-4.5z" /><path d="M3 12.5l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5" /></Icon>,
  list: <Icon size={20}><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" /></Icon>,
  bulb: <Icon size={20}><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></Icon>,
  arrowLeft: <Icon size={18}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>,
  chevronRight: <Icon size={18}><path d="M9 6l6 6-6 6" /></Icon>,
  check: <Icon size={18}><path d="M5 12.5l4.5 4.5L19 7.5" /></Icon>,
  cross: <Icon size={18}><path d="M6 6l12 12M18 6L6 18" /></Icon>,
};

