import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { scriptedAiProvider } from "../services/testing/scripted-ai-provider.ts";
import { recordRun } from "./staged-recording.ts";

const folder = () => {
  const dir = mkdtempSync(join(tmpdir(), "autoai-recordings-"));
  writeFileSync(join(dir, "case-1.json"), "OLD 1");
  writeFileSync(join(dir, "case-2.json"), "OLD 2");
  writeFileSync(join(dir, "other-1.json"), "OTHER");
  return dir;
};
const untouched = (dir: string) => {
  expect(readdirSync(dir).sort()).toStrictEqual(["case-1.json", "case-2.json", "other-1.json"]);
  expect(readFileSync(join(dir, "case-1.json"), "utf8")).toBe("OLD 1");
};
const ask = (n: number) => async (ai: Parameters<Parameters<typeof recordRun>[0]["run"]>[0]) => {
  const results = [];
  for (let i = 0; i < n; i++)
    results.push(await ai.complete({ system: "S", user: `U${String(i)}` }));
  return results;
};

describe("recordRun", () => {
  it("a failed call (any code) is never saved, and the folder is unchanged; the answers are still returned", async () => {
    const dir = folder();
    const run = await recordRun({
      inner: scriptedAiProvider("good answer", { code: "AI_RATE_LIMITED", message: "429" }),
      dir,
      name: "case",
      run: ask(2),
      failureOf: () => null,
    });
    expect(run.recording).toStrictEqual({
      ok: false,
      error: { code: "AI_RATE_LIMITED", message: "429" },
    });
    expect(run.value[0]?.ok).toBe(true);
    untouched(dir);
  });

  it("a failure the case reports (e.g. an answer that stayed invalid) saves nothing", async () => {
    const dir = folder();
    const run = await recordRun({
      inner: scriptedAiProvider("nonsense"),
      dir,
      name: "case",
      run: ask(1),
      failureOf: () => ({ code: "INVALID_AI_OUTPUT", message: "not JSON" }),
    });
    expect(run.recording.ok ? null : run.recording.error.code).toBe("INVALID_AI_OUTPUT");
    untouched(dir);
  });

  it("a call that could not be written to the staging folder saves nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const dir = folder();
    const run = await recordRun({
      inner: scriptedAiProvider("answer"),
      dir,
      name: "case",
      // A request JSON cannot hold, so its recording fails to write.
      run: (ai) => ai.complete({ system: "S", user: "U", jsonSchema: { big: 1n } }),
      failureOf: () => null,
    });
    expect(run.recording.ok ? null : run.recording.error.code).toBe("RECORDING_NOT_WRITTEN");
    untouched(dir);
  });

  it("success replaces only this case's old recordings, and keeps other cases", async () => {
    const dir = folder();
    const run = await recordRun({
      inner: scriptedAiProvider("only answer"),
      dir,
      name: "case",
      run: ask(1),
      failureOf: () => null,
    });
    expect(run.recording).toStrictEqual({ ok: true, value: { files: ["case-1.json"] } });
    expect(readdirSync(dir).sort()).toStrictEqual(["case-1.json", "other-1.json"]);
    const saved = JSON.parse(readFileSync(join(dir, "case-1.json"), "utf8")) as {
      result: { ok: boolean };
    };
    expect(saved.result.ok).toBe(true);
  });

  it("creates the folder only on success", async () => {
    const dir = join(mkdtempSync(join(tmpdir(), "autoai-recordings-")), "new");
    await recordRun({
      inner: scriptedAiProvider({ code: "AI_AUTH_FAILED", message: "rejected" }),
      dir,
      name: "case",
      run: ask(1),
      failureOf: () => null,
    });
    expect(() => readdirSync(dir)).toThrow();
  });
});
