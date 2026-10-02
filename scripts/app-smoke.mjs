#!/usr/bin/env node
// Launches the built app (npm run app:build first) with Playwright's Electron support and checks the shell:
// the window opens, the page has no Node, the bridge exists with only its two functions, a contract round-trip
// works, a bad request is refused, and the page's CSP is the strict one. Uses a throwaway user-data folder.
// Usage: node scripts/app-smoke.mjs
/* global window, document, getComputedStyle -- page.evaluate callbacks run in the app's page */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { _electron as electron } from "@playwright/test";

const userData = mkdtempSync(join(tmpdir(), "autoai-smoke-"));
// VS Code's terminals set ELECTRON_RUN_AS_NODE, which would start Electron as plain Node: clear it.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [".", `--user-data-dir=${userData}`], env });
const problems = [];
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) problems.push(what);
};
try {
  const page = await app.firstWindow();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.waitForLoadState("domcontentloaded");
  check((await page.title()) === "AutoAI", "the window opens on our page");
  check(await page.evaluate(() => typeof require === "undefined" && typeof process === "undefined"), "the page has no Node (require, process)");
  check(
    JSON.stringify(await page.evaluate(() => Object.keys(window.autoai ?? {}).sort())) === '["invoke","on"]',
    "window.autoai exposes only invoke and on",
  );
  const status = await page.evaluate(() => window.autoai.invoke("ai:status", {}));
  check(JSON.stringify(status) === '{"ok":true,"value":{"configured":false}}', `ai:status round-trips through main: ${JSON.stringify(status)}`);
  const refused = await page.evaluate(() =>
    window.autoai.invoke("ai:save-key", { key: "x", extra: 1 }).then(() => "accepted", (e) => String(e)),
  );
  check(refused !== "accepted", "a request that breaks its contract is refused by main");
  const unknown = await page.evaluate(() =>
    window.autoai.invoke("fs:read", {}).then(() => "accepted", (e) => String(e)),
  );
  check(unknown.includes("no such channel"), "an unknown channel is refused by the preload");
  const csp = await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? "");
  check(csp.includes("script-src 'self';") && !/script-src[^;]*unsafe-inline/.test(csp), "the built page keeps scripts strict");
  const inline = await page.evaluate(() => {
    const s = document.createElement("script");
    s.textContent = "window.__inlineRan = true";
    document.head.append(s);
    return window.__inlineRan === true;
  });
  check(!inline, "an injected inline script does not run");
  const styled = await page.evaluate(() => {
    // What Radix's scroll lock does when a Modal or Select opens: add a <style> tag.
    const style = document.createElement("style");
    style.textContent = "body { --smoke-check: 1; }";
    document.head.append(style);
    const applied = getComputedStyle(document.body).getPropertyValue("--smoke-check").trim() === "1";
    style.remove();
    return applied;
  });
  check(styled, "an added <style> tag applies (Radix scroll lock behind a Modal or Select)");
  const fonts = await page.evaluate(async () => {
    // Fonts load when first used; the empty shell has no text yet, so ask for them explicitly.
    const inter = await document.fonts.load("16px Inter");
    const mono = await document.fonts.load("16px 'JetBrains Mono'");
    return inter.length > 0 && mono.length > 0 && inter.every((f) => f.status === "loaded");
  });
  check(fonts, "Inter and JetBrains Mono load under the CSP");
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector("main")).backgroundColor);
  check(bg === "rgb(14, 15, 20)", `tokens load (canvas background ${bg})`);
  // The only error expected is the inline script this check injected itself (refused by the CSP).
  const unexpected = errors.filter((e) => !e.startsWith("Executing inline script violates"));
  check(unexpected.length === 0, `no console errors ${JSON.stringify(unexpected)}`);
} finally {
  await app.close();
}
if (problems.length > 0) {
  console.error(`\napp smoke FAILED: ${String(problems.length)} problem(s)`);
  process.exit(1);
}
console.log("\napp smoke OK");
