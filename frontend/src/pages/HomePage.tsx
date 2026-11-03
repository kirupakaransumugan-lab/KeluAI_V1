import { Navbar } from "../layouts/Navbar";
import { Hero } from "./home/Hero";

export function HomePage() {
  return (
    <div className="page">
      <Navbar />
      <main>
        <Hero />
      </main>
    </div>
  );
}
