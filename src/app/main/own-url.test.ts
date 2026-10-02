import { describe, expect, it } from "vitest";
import { isOwnUrl, type RendererSource } from "./own-url.ts";

describe("isOwnUrl: only our own screens", () => {
  const dev: RendererSource = { kind: "dev", url: "http://localhost:5199/" };
  const mac: RendererSource = { kind: "file", path: "/Apps/AutoAI/dist/app/renderer/index.html" };
  const spaced: RendererSource = {
    kind: "file",
    path: "/Users/a/My Apps/AutoAI/renderer/index.html",
  };

  it.each<[RendererSource, string, boolean]>([
    [dev, "http://localhost:5199/", true],
    [dev, "http://localhost:5199/index.html#x", true],
    [dev, "http://localhost:5200/", false],
    [dev, "http://localhost:5199.evil.example/", false],
    [dev, "https://evil.example/", false],
    [mac, "file:///Apps/AutoAI/dist/app/renderer/index.html", true],
    [mac, "file:///Apps/AutoAI/dist/app/renderer/assets/x.js", true],
    [mac, "file:///Apps/AutoAI/dist/app/rendererX/index.html", false],
    [mac, "file:///etc/passwd", false],
    [mac, "https://example.com/", false],
    [mac, "", false],
    [spaced, "file:///Users/a/My%20Apps/AutoAI/renderer/index.html", true],
  ])("%o: %s -> %s", (source, url, expected) => {
    expect(isOwnUrl(url, source)).toBe(expected);
  });

  it.runIf(process.platform === "win32")("a Windows drive path", () => {
    const win: RendererSource = {
      kind: "file",
      path: "C:\\\\Program Files\\\\AutoAI\\\\renderer\\\\index.html",
    };
    expect(isOwnUrl("file:///C:/Program%20Files/AutoAI/renderer/index.html", win)).toBe(true);
  });
});
