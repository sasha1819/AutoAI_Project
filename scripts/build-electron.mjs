#!/usr/bin/env node
// Builds the Electron app into dist/app (ADR 0007): the renderer (vite.renderer.config.ts), then main (ESM, its
// npm dependencies left external) and the preload (one sandbox-safe CommonJS file). Usage:
//   node scripts/build-electron.mjs          build everything
//   node scripts/build-electron.mjs --dev    start the renderer dev server, build main + preload, launch Electron
import { spawn } from "node:child_process";
import electronPath from "electron";
import { build, createServer } from "vite";

const dev = process.argv.includes("--dev");
const out = "dist/app";

async function buildMainAndPreload() {
  await build({
    configFile: false,
    logLevel: "warn",
    build: {
      ssr: "src/app/main/main.ts",
      outDir: out,
      emptyOutDir: false,
      target: "node22",
      sourcemap: true,
      rolldownOptions: { output: { format: "es", entryFileNames: "main.js" } },
    },
  });
  await build({
    configFile: false,
    logLevel: "warn",
    build: {
      outDir: out,
      emptyOutDir: false,
      target: "chrome140",
      sourcemap: true,
      lib: { entry: "src/app/preload/preload.ts", formats: ["cjs"], fileName: () => "preload.cjs" },
      rolldownOptions: { external: ["electron"] },
    },
  });
}

if (dev) {
  const server = await createServer({ configFile: "vite.renderer.config.ts" });
  await server.listen();
  const url = server.resolvedUrls?.local[0];
  if (url === undefined) throw new Error("the renderer dev server did not start");
  await buildMainAndPreload();
  // VS Code's terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node: clear it.
  const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
  const app = spawn(electronPath, ["."], { stdio: "inherit", env: { ...env, AUTOAI_RENDERER_URL: url } });
  app.on("exit", (code) => {
    void server.close().then(() => process.exit(code ?? 0));
  });
} else {
  await build({ configFile: "vite.renderer.config.ts", logLevel: "warn" });
  await buildMainAndPreload();
  console.log(`built ${out}: main.js, preload.cjs, renderer/`);
}
