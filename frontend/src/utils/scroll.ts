/** Scroll a landing-page section into view (smoothly, per `html { scroll-behavior }`).
 *  Lazy images above it load during the scroll and push it down, so when the scroll ends it
 *  jumps the rest of the way if the section is no longer where it should be. */
export function scrollToSection(el: HTMLElement): void {
  el.scrollIntoView();
  const settle = () => {
    const want = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    if (Math.abs(el.getBoundingClientRect().top - want) > 4) el.scrollIntoView({ behavior: "instant" });
  };
  // Browsers without the scrollend event (older Safari) get one late check instead.
  if ("onscrollend" in window) window.addEventListener("scrollend", settle, { once: true });
  else setTimeout(settle, 900);
}
