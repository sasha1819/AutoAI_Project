import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scriptedAiProvider } from "../services/testing/scripted-ai-provider.ts";
import { recordingAiProvider } from "./recording-ai-provider.ts";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("recordingAiProvider", () => {
  it("passes every call through and saves the request and the result, one file per call", async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "autoai-record-")), "claude");
    dirs.push(dirname(dir));
    const inner = scriptedAiProvider('{"findings": []}', { code: "AI_REFUSED", message: "no" });
    const ai = recordingAiProvider(inner, dir, "run1");

    const first = await ai.complete({ system: "S", user: "U1", jsonSchema: { type: "object" } });
    const second = await ai.complete({ system: "S", user: "U2" });

    expect(first.ok && first.value.text).toBe('{"findings": []}');
    expect(second.ok ? null : second.error.code).toBe("AI_REFUSED");
    expect(readdirSync(dir).sort()).toStrictEqual(["run1-1.json", "run1-2.json"]);
    expect(JSON.parse(readFileSync(join(dir, "run1-1.json"), "utf8"))).toStrictEqual({
      request: { system: "S", user: "U1", jsonSchema: { type: "object" } },
      result: first,
    });
  });
});

describe("recordingAiProvider when the folder cannot be written", () => {
  it("still returns the answer, so a paid-for scan is never lost to a recording problem", async () => {
    const parent = mkdtempSync(join(tmpdir(), "autoai-record-"));
    dirs.push(parent);
    const blocker = join(parent, "not-a-folder");
    writeFileSync(blocker, "x");
    const ai = recordingAiProvider(
      scriptedAiProvider('{"findings": []}'),
      join(blocker, "claude"),
      "run1",
    );
    const result = await ai.complete({ system: "S", user: "U" });
    expect(result.ok && result.value.text).toBe('{"findings": []}');
  });
});

function dirname(path: string): string {
  return path.slice(0, path.lastIndexOf("/"));
}
