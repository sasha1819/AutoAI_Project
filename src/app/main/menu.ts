import { app, Menu } from "electron";
import { appMenuTemplate } from "./menu-template.ts";

/** Puts the app's menus in the system menu bar. */
export function installAppMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      appMenuTemplate({ platform: process.platform, developing: !app.isPackaged }),
    ),
  );
}
