import { join } from "node:path";
import { app, BrowserWindow, dialog, ipcMain, safeStorage, session } from "electron";
import { INVOKE_CHANNELS } from "../../contracts/channels.ts";
import { composeApp } from "./compose.ts";
import { createHandlers } from "./handlers.ts";
import { isOwnUrl, type RendererSource } from "./own-url.ts";
import { createMainWindow } from "./window.ts";

// Electron entry (ADR 0007). Built by Vite into dist/app/main.js, next to preload.cjs and renderer/.
const here = import.meta.dirname;
const devUrl = process.env["AUTOAI_RENDERER_URL"];
const source: RendererSource =
  devUrl !== undefined && !app.isPackaged
    ? { kind: "dev", url: devUrl }
    : { kind: "file", path: join(here, "renderer", "index.html") };

app.whenReady().then(
  () => {
    // The screens ask for no device or notification permissions; refuse any that a page might request.
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
      callback(false);
    });

    let window: BrowserWindow | undefined;
    const services = composeApp({
      userDataDir: app.getPath("userData"),
      safeStorage,
      pickFolder: async (purpose) => {
        const options = {
          title:
            purpose === "repo"
              ? "Choose your project's folder"
              : "Choose the folder with your PRDs",
          buttonLabel: "Choose",
          properties: ["openDirectory" as const],
        };
        const picked =
          window === undefined
            ? await dialog.showOpenDialog(options)
            : await dialog.showOpenDialog(window, options);
        return picked.canceled ? null : (picked.filePaths[0] ?? null);
      },
    });
    const handlers = createHandlers(services);
    for (const channel of INVOKE_CHANNELS) {
      ipcMain.handle(channel, (event, request: unknown) => {
        // Only our own screens may call main (ADR 0007).
        if (!isOwnUrl(event.senderFrame?.url ?? "", source))
          throw new Error(`refused ${channel} from another page`);
        return handlers[channel](request, (eventChannel, payload) => {
          // The window may have closed mid-scan: the scan finishes regardless, nobody is told.
          if (!event.sender.isDestroyed()) event.sender.send(eventChannel, payload);
        });
      });
    }

    window = createMainWindow(source, here);
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) window = createMainWindow(source, here);
    });
  },
  (e: unknown) => {
    console.error(e);
    app.quit();
  },
);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
