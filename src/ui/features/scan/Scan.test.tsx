import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelResponse } from "../../../contracts/channels.ts";
import type { ScanReport } from "../../../contracts/scan.ts";
import { installFakeBridge, removeFakeBridge } from "../../app/testing/fake-bridge.ts";
import { STOPPED_MESSAGE, SCAN_MESSAGE, WARNING_MESSAGE } from "./messages.ts";
import { Scan, ScanView, type ScanViewProps } from "./Scan.tsx";

type Reply = ChannelResponse<"scan:run">;
const report = (over: Partial<ScanReport> = {}): ScanReport => ({
  prdFiles: ["cart.md"],
  sourceFiles: 4,
  requirements: [
    {
      tag: "Cart 2.4",
      area: "Cart",
      text: "Codes are case-insensitive.",
      source: { file: "cart.md", line: 1 },
    },
  ],
  findings: [],
  notScanned: [],
  warnings: [],
  stoppedBy: null,
  models: ["claude-sonnet-5"],
  usage: { aiCalls: 1, inputTokens: 2400, outputTokens: 600 },
  ...over,
});
const statusText = () =>
  screen
    .getAllByRole("status")
    .map((s) => s.textContent)
    .join(" | ");
const rows = () =>
  [...screen.getByRole("list", { name: "Scan steps" }).querySelectorAll("li")].map(
    (li) => li.textContent,
  );
const target = { repoRoot: "/work/shop", prdFolder: "/work/shop/docs" };

afterEach(() => {
  removeFakeBridge();
});

describe("ScanView", () => {
  const base: ScanViewProps = {
    repoRoot: "/work/shop",
    events: [],
    outcome: "running",
    report: null,
    onSeeResults: vi.fn(),
    onBack: vi.fn(),
    onConnectAi: vi.fn(),
  };

  it("running: the steps, the bar while comparing, no way out yet", () => {
    render(
      <ScanView
        {...base}
        events={[
          { at: 0, progress: { stage: "prds_read", prdFiles: 1, requirements: 3 } },
          { at: 1, progress: { stage: "code_read", sourceFiles: 9 } },
          { at: 2, progress: { stage: "matching", area: "Cart", batch: 2, batches: 4 } },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Scanning your project" })).toBeTruthy();
    expect(
      screen
        .getByRole("progressbar", { name: "Comparison progress" })
        .getAttribute("aria-valuetext"),
    ).toBe("1 of 4 areas compared");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("done: counts, cost in tokens, and See results takes focus", async () => {
    const onSeeResults = vi.fn();
    const done = report();
    render(<ScanView {...base} outcome="done" report={done} onSeeResults={onSeeResults} />);
    expect(screen.getByRole("heading", { name: "Scan complete" })).toBeTruthy();
    expect(statusText()).toContain("1 requirement read, 0 findings.");
    expect(statusText()).toContain(
      "1 Claude call: 2,400 tokens sent, 600 received (billed by Anthropic).",
    );
    const see = screen.getByRole("button", { name: "See results" });
    expect(document.activeElement).toBe(see);
    await userEvent.click(see);
    expect(onSeeResults).toHaveBeenCalledWith(done);
  });

  it("no AI calls and warnings are said once per kind", () => {
    render(
      <ScanView
        {...base}
        outcome="done"
        report={report({
          usage: { aiCalls: 0, inputTokens: 0, outputTokens: 0 },
          warnings: [
            { code: "SOURCE_FILE_UNREADABLE", message: "a.js" },
            { code: "SOURCE_FILE_UNREADABLE", message: "b.js" },
            { code: "NO_PRD_FILES", message: "none" },
          ],
        })}
      />,
    );
    expect(statusText()).toContain("No AI calls were made.");
    expect(screen.getAllByText(WARNING_MESSAGE.SOURCE_FILE_UNREADABLE)).toHaveLength(1);
    expect(screen.getByText(WARNING_MESSAGE.NO_PRD_FILES)).toBeTruthy();
  });

  it("stopped by Claude: says why, keeps the findings, and still offers the results", () => {
    render(
      <ScanView
        {...base}
        outcome="stopped"
        report={report({ stoppedBy: { code: "AI_RATE_LIMITED", message: "429" } })}
      />,
    );
    expect(screen.getByRole("heading", { name: "The scan stopped early" })).toBeTruthy();
    expect(statusText()).toContain(STOPPED_MESSAGE.AI_RATE_LIMITED);
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
  });

  it("Anthropic rejecting the key mid-scan offers Connect Claude, and See results stays", () => {
    render(
      <ScanView
        {...base}
        outcome="stopped"
        report={report({ stoppedBy: { code: "AI_AUTH_FAILED", message: "401" } })}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Connect Claude" }));
    expect(screen.getByRole("button", { name: "See results" })).toBeTruthy();
  });

  it("when it ends, the focused action reads the outcome with it", () => {
    render(<ScanView {...base} outcome="done" report={report()} />);
    const see = screen.getByRole("button", { name: "See results" });
    const summary = document.getElementById(see.getAttribute("aria-describedby") ?? "");
    expect(summary?.textContent).toContain("Scan complete.");
    expect(summary?.textContent).toContain("1 requirement read");
  });

  it("a failure with nothing else to do focuses Back", () => {
    render(
      <ScanView {...base} outcome="failed" error={SCAN_MESSAGE.SCAN_BUSY} errorCode="SCAN_BUSY" />,
    );
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Back to your project" }),
    );
    expect(rows().every((r) => r.includes("not run"))).toBe(true);
  });

  it("a key problem offers Connect Claude; another failure only goes back", async () => {
    const onConnectAi = vi.fn();
    const { rerender } = render(
      <ScanView
        {...base}
        outcome="failed"
        error={SCAN_MESSAGE.SECRET_STORE_FAILED}
        errorCode="SECRET_STORE_FAILED"
        onConnectAi={onConnectAi}
      />,
    );
    expect(screen.getByRole("heading", { name: "The scan didn't run" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Connect Claude" }));
    expect(onConnectAi).toHaveBeenCalledOnce();
    rerender(
      <ScanView
        {...base}
        outcome="failed"
        error={SCAN_MESSAGE.PATH_NOT_FOUND}
        errorCode="PATH_NOT_FOUND"
      />,
    );
    expect(screen.queryByRole("button", { name: "Connect Claude" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back to your project" })).toBeTruthy();
  });
});

describe("Scan (with its hook)", () => {
  it("starts one scan (even under StrictMode's double start) and follows its progress to the end", async () => {
    let finish: (r: Reply) => void = () => undefined;
    const bridge = installFakeBridge({
      "scan:run": () =>
        new Promise<Reply>((resolve) => {
          finish = resolve;
        }),
    });
    render(
      <StrictMode>
        <Scan target={target} onSeeResults={vi.fn()} onBack={vi.fn()} onConnectAi={vi.fn()} />
      </StrictMode>,
    );
    await waitFor(() => {
      expect(bridge.calls.filter((c) => c.channel === "scan:run")).toHaveLength(1);
    });
    expect(bridge.calls[0]?.request).toStrictEqual(target);
    expect(bridge.listening("scan:progress")).toBe(1);
    act(() => {
      bridge.emit("scan:progress", { progress: { stage: "reading_prds" } });
      bridge.emit("scan:progress", {
        progress: { stage: "prds_read", prdFiles: 1, requirements: 1 },
      });
      bridge.emit("scan:progress", { progress: { stage: "reading_code" } });
    });
    expect(rows()[0]).toContain("Read your PRDs: 1 requirement in 1 file");
    act(() => {
      bridge.emit("scan:progress", { progress: { stage: "code_read", sourceFiles: 4 } });
      bridge.emit("scan:progress", {
        progress: { stage: "matching", area: "Cart", batch: 1, batches: 1 },
      });
      bridge.emit("scan:progress", { progress: { stage: "done" } });
      finish({ ok: true, value: report() });
    });
    expect(await screen.findByRole("heading", { name: "Scan complete" })).toBeTruthy();
    expect(rows()[2]).toContain("Compare with Claude: 1 area");
  });

  it("a NO_KEY reply (the key went away after Scan) is said in words, with Connect Claude", async () => {
    installFakeBridge({
      "scan:run": () =>
        Promise.resolve<Reply>({ ok: false, error: { code: "NO_KEY", message: "no key" } }),
    });
    render(<Scan target={target} onSeeResults={vi.fn()} onBack={vi.fn()} onConnectAi={vi.fn()} />);
    expect(await screen.findByText(SCAN_MESSAGE.NO_KEY)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Connect Claude" })).toBeTruthy();
    expect(rows()[0]).toContain("Read your PRDs");
  });

  it("a broken reply says so instead of hanging", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    installFakeBridge({ "scan:run": () => Promise.reject(new Error("contract broken")) });
    render(<Scan target={target} onSeeResults={vi.fn()} onBack={vi.fn()} onConnectAi={vi.fn()} />);
    await waitFor(() => {
      expect(statusText()).toContain("Something went wrong inside AutoAI");
    });
  });
});
