import { join } from "node:path";
import { app, BrowserWindow } from "electron";
import { isOwnUrl, type RendererSource } from "./own-url.ts";

/** The main window, locked down (ADR 0007): no Node in the page, sandboxed, isolated, no navigating away. */
export function createMainWindow(
  source: RendererSource,
  preloadDir: string,
  mockAi: boolean,
): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#0b0c10", // tokens-ignore: shown before the page paints; matches --tk-bg-app
    // Mock mode says so in the title bar too, so it can't be mistaken for a real connection.
    title: mockAi ? "AutoAI — MOCK AI" : "AutoAI",
    webPreferences: {
      preload: join(preloadDir, "preload.cjs"),
      contextIsolation: true,
      // Off at the source in a packaged app; the menu also hides it, but must not be the only gate.
      devTools: !app.isPackaged,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  // The page's <title> would replace the window title; in mock mode the "MOCK AI" title must stay.
  window.on("page-title-updated", (event) => {
    if (mockAi) event.preventDefault();
  });
  window.once("ready-to-show", () => {
    window.show();
  });
  // The window never opens other windows or leaves our screens. Outside addresses open in the user's browser only
  // through the link:open channel, whose schema allows a fixed list (contracts/links.ts).
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isOwnUrl(url, source)) event.preventDefault();
  });
  if (source.kind === "dev") void window.loadURL(source.url);
  else void window.loadFile(source.path);
  return window;
}
