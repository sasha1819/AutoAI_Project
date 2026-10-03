import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it } from "vitest";
import { appMenuTemplate } from "./menu-template.ts";

const roles = (items: readonly MenuItemConstructorOptions[]): string[] =>
  items.flatMap((i) => [
    ...(i.role === undefined ? [] : [i.role]),
    ...(Array.isArray(i.submenu) ? roles(i.submenu) : []),
  ]);

describe("appMenuTemplate", () => {
  it.each(["darwin", "win32", "linux"] as const)(
    "a packaged app on %s has no reload or developer tools",
    (platform) => {
      const found = roles(appMenuTemplate({ platform, developing: false }));
      expect(found).not.toContain("reload");
      expect(found).not.toContain("toggleDevTools");
      expect(found).toContain("editMenu");
    },
  );

  it("while developing, reload and the developer tools are there", () => {
    const found = roles(appMenuTemplate({ platform: "darwin", developing: true }));
    expect(found).toEqual(expect.arrayContaining(["reload", "toggleDevTools"]));
  });

  it("the app menu on macOS, a File menu elsewhere", () => {
    expect(roles(appMenuTemplate({ platform: "darwin", developing: false }))[0]).toBe("appMenu");
    expect(roles(appMenuTemplate({ platform: "win32", developing: false }))[0]).toBe("fileMenu");
  });
});
