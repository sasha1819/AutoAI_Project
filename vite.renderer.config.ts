import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

export const DEV_PORT = 5199;

// In development only, Vite's live reload needs an inline script and a websocket; the built app keeps index.html's
// strict script policy (ADR 0007).
function devContentSecurityPolicy(): Plugin {
  return {
    name: "autoai-dev-csp",
    apply: "serve",
    transformIndexHtml: (html) =>
      html
        .replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", `connect-src 'self' ws://localhost:${String(DEV_PORT)}`),
  };
}

/** The renderer: the React app in src/ui, built into dist/app/renderer and loaded by the Electron window. */
export default defineConfig({
  root: "src/ui",
  base: "./",
  plugins: [react(), tailwindcss(), devContentSecurityPolicy()],
  server: { port: DEV_PORT, strictPort: true, host: "localhost" },
  build: {
    outDir: "../../dist/app/renderer",
    emptyOutDir: true,
    target: "chrome140",
    // Fonts and images ship as files: inlined data: URLs would need a looser CSP (font-src 'self' only).
    assetsInlineLimit: 0,
  },
});
