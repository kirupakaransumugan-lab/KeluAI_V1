import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin /api in dev, so the httpOnly session cookie just works (no CORS round-trips).
    // KELU_API_URL overrides the target, e.g. when port 8000 is taken by another local service.
    proxy: { "/api": process.env.KELU_API_URL ?? "http://localhost:8000" },
  },
});
