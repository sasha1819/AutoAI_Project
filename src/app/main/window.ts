import { join } from "node:path";
import { app, BrowserWindow, shell } from "electron";
import { isOwnUrl, type RendererSource } from "./own-url.ts";

/** The main window, locked down (ADR 0007): no Node in the page, sandboxed, isolated, no navigating away. */
export function createMainWindow(source: RendererSource, preloadDir: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: "#0b0c10", // tokens-ignore: shown before the page paints; matches --tk-bg-app
    title: "AutoAI",
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
  window.once("ready-to-show", () => {
    window.show();
  });
  // Links to the outside open in the user's browser; the window itself never leaves our screens.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isOwnUrl(url, source)) event.preventDefault();
  });
  if (source.kind === "dev") void window.loadURL(source.url);
  else void window.loadFile(source.path);
  return window;
}
