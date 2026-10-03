import type { MenuItemConstructorOptions } from "electron";

/**
 * The app's menus (ADR 0007: native frame, system menu bar), from standard roles only. Edit gives copy/paste in
 * fields; reload and the developer tools exist only while developing. Pure, so the packaged menu is tested.
 */
export function appMenuTemplate(options: {
  readonly platform: NodeJS.Platform;
  readonly developing: boolean;
}): MenuItemConstructorOptions[] {
  return [
    options.platform === "darwin" ? { role: "appMenu" } : { role: "fileMenu" },
    { role: "editMenu" },
    {
      label: "View",
      submenu: [
        ...(options.developing
          ? [
              { role: "reload" as const },
              { role: "toggleDevTools" as const },
              { type: "separator" as const },
            ]
          : []),
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { role: "windowMenu" },
  ];
}
