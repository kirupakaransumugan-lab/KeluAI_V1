import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Navbar } from "../layouts/Navbar";
import { scrollToSection } from "../utils/scroll";
import { Features } from "./home/Features";
import { Hero } from "./home/Hero";
import { HowItWorks, SignupCta } from "./home/HowItWorks";
import { Pricing } from "./home/Pricing";

/** The public landing page: one scrolling page. The navbar sticks to the top and its links
 *  scroll to the sections below (#how-it-works, #features, #pricing). */
export function HomePage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();

  // The navbar's height (with its top margin) as --nav-h: the hero fills the rest of the first
  // screen, and a section reached from a link stops just below the navbar, not under it.
  useLayoutEffect(() => {
    const root = rootRef.current;
    const nav = root?.querySelector<HTMLElement>(".navbar");
    if (!root || !nav) return;
    const measure = () => {
      const top = parseFloat(getComputedStyle(nav).marginTop) || 0;
      root.style.setProperty("--nav-h", `${Math.ceil(top + nav.offsetHeight)}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    return () => ro.disconnect();
  }, []);

  // Arriving with a section in the URL (from another page, or an old /pricing link): the browser
  // looked for it before React drew the page, so jump to it now.
  useEffect(() => {
    const el = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (el) scrollToSection(el);
  }, [hash]);

  return (
    <div ref={rootRef} className="landing how-page">
      <Navbar />
      <main className="landing-main">
        <div id="home" className="page landing-hero">
          <div className="landing-hero-main">
            <Hero />
          </div>
        </div>
        <div className="landing-rest">
          <HowItWorks />
          <Features />
          <Pricing />
          <SignupCta />
        </div>
      </main>
    </div>
  );
}
