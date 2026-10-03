import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelResponse } from "../../../contracts/channels.ts";
import { installFakeBridge, removeFakeBridge } from "../../app/testing/fake-bridge.ts";
import { AddProject, AddProjectView, type AddProjectViewProps } from "./AddProject.tsx";
import { READ_PRDS_MESSAGE, KEY_MESSAGE } from "./messages.ts";

type ReadPrds = ChannelResponse<"project:read-prds">;
const summary = (files: [string, number][]): ReadPrds => ({
  ok: true,
  value: {
    files: files.map(([file, requirements]) => ({
      file,
      requirements,
      chars: 1200,
      claude: requirements > 0 ? ("not_needed" as const) : ("will_read" as const),
    })),
    requirements: files.reduce((n, [, r]) => n + r, 0),
    maxChars: 50000,
    extraCalls: 0,
  },
});
const NONE = { repoFolder: null, prdFolder: null };
const connected = () =>
  Promise.resolve<ChannelResponse<"ai:status">>({ ok: true, value: { configured: true } });
const status = () =>
  screen
    .getAllByRole("status")
    .map((s) => s.textContent)
    .join(" | ");
const scanButton = () => screen.getByRole("button", { name: "Scan project" });

afterEach(() => {
  removeFakeBridge();
});

describe("AddProjectView", () => {
  const base: AddProjectViewProps = {
    repoFolder: null,
    prdFolder: null,
    ai: { kind: "connected" },
    onConnectAi: vi.fn(),
    prds: { kind: "none" },
    picking: null,
    onChooseRepo: vi.fn(),
    onChoosePrds: vi.fn(),
    project: null,
    onScan: vi.fn(),
  };

  it("nothing chosen: Scan waits for the project folder", () => {
    render(<AddProjectView {...base} />);
    expect(scanButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Choose your project's folder to scan it.")).toBeTruthy();
  });

  it("PRDs in plain prose: says 0 requirements, that Claude will read them, and the extra calls, before Scan", () => {
    render(
      <AddProjectView
        {...base}
        repoFolder="/r"
        prdFolder="/p"
        prds={{
          kind: "read",
          summary: {
            files: [{ file: "vision.md", requirements: 0, chars: 1200, claude: "will_read" }],
            requirements: 0,
            maxChars: 50000,
            extraCalls: 1,
          },
        }}
        project={{ repoRoot: "/r", prdFolder: "/p" }}
      />,
    );
    expect(status()).toContain("No requirements found in 1 PRD file.");
    expect(screen.getByText("Your PRDs are written as prose")).toBeTruthy();
    expect(screen.getByText(/AutoAI finds requirements under headings/)).toBeTruthy();
    expect(
      screen.getByText(
        /vision\.md is written as prose, so Claude reads it during the scan\. Each requirement it finds must be quoted/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Claude reads 1 PRD file written as prose (1 extra call), then compares what it finds with your code. Uses your API key (billed by Anthropic).",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("list", { name: "PRD files" })).toBeNull();
  });

  it("a plain-prose file over the size cap is named with its size and the limit, and not read", () => {
    render(
      <AddProjectView
        {...base}
        repoFolder="/r"
        prdFolder="/p"
        prds={{
          kind: "read",
          summary: {
            files: [{ file: "big.md", requirements: 0, chars: 120431, claude: "too_large" }],
            requirements: 0,
            maxChars: 50000,
            extraCalls: 0,
          },
        }}
        project={{ repoRoot: "/r", prdFolder: "/p" }}
      />,
    );
    expect(
      screen.getByText(
        "big.md is too large for Claude to read (120,431 characters; the limit is 50,000). Split it into smaller files, or add headings so AutoAI can read it without Claude.",
      ),
    ).toBeTruthy();
    expect(status()).toContain(
      "No requirements found in 1 PRD file. 1 file is too large for Claude.",
    );
    expect(screen.getByText(/It makes no AI calls\./)).toBeTruthy();
  });

  it("parsed and plain-prose files together: both said, with the extra calls", () => {
    render(
      <AddProjectView
        {...base}
        repoFolder="/r"
        prdFolder="/p"
        prds={{
          kind: "read",
          summary: {
            files: [
              { file: "cart.md", requirements: 4, chars: 900, claude: "not_needed" },
              { file: "a.md", requirements: 0, chars: 900, claude: "will_read" },
              { file: "b.md", requirements: 0, chars: 900, claude: "will_read" },
            ],
            requirements: 4,
            maxChars: 50000,
            extraCalls: 2,
          },
        }}
        project={{ repoRoot: "/r", prdFolder: "/p" }}
      />,
    );
    expect(
      screen.getByText(
        "Claude reads 2 PRD files written as prose (2 extra calls), then compares what it finds and the 4 requirements with your code. Uses your API key (billed by Anthropic).",
      ),
    ).toBeTruthy();
  });

  it("a folder with no PRD files says so and what AutoAI reads", () => {
    render(<AddProjectView {...base} prdFolder="/p" prds={{ kind: "no-files" }} />);
    expect(status()).toContain("No PRD files in this folder.");
    expect(screen.getByText(/AutoAI reads \.md, \.markdown and \.txt files/)).toBeTruthy();
  });

  it("PRDs with requirements: a count, one tag per file, files without any named, and the cost said", () => {
    const onScan = vi.fn();
    render(
      <AddProjectView
        {...base}
        repoFolder="/r"
        prdFolder="/p"
        prds={{
          kind: "read",
          summary: {
            files: [
              { file: "cart.md", requirements: 12, chars: 1200, claude: "not_needed" },
              { file: "notes.md", requirements: 0, chars: 1200, claude: "will_read" },
            ],
            requirements: 12,
            maxChars: 50000,
            extraCalls: 1,
          },
        }}
        project={{ repoRoot: "/r", prdFolder: "/p" }}
        onScan={onScan}
      />,
    );
    expect(status()).toContain("Found 12 requirements in 2 PRD files.");
    const tags = screen.getByRole("list", { name: "PRD files" }).querySelectorAll("li");
    expect([...tags].map((t) => t.textContent)).toStrictEqual([
      "cart.md · 12 requirements",
      "notes.md · 0 requirements · read by Claude",
    ]);
    expect(
      screen.getByText(/notes\.md is written as prose, so Claude reads it during the scan/),
    ).toBeTruthy();
    expect(screen.getByText(/Uses your API key \(billed by Anthropic\)/)).toBeTruthy();
    scanButton().click();
    expect(onScan).toHaveBeenCalledWith({ repoRoot: "/r", prdFolder: "/p" });
  });

  it("no key: Scan is disabled with 'Connect Claude to scan' and a way back; PRDs are still read", async () => {
    const onConnectAi = vi.fn();
    render(
      <AddProjectView
        {...base}
        ai={{ kind: "missing", message: KEY_MESSAGE.NO_KEY }}
        onConnectAi={onConnectAi}
        repoFolder="/r"
        prdFolder="/p"
        prds={{
          kind: "read",
          summary: {
            files: [{ file: "cart.md", requirements: 4, chars: 1200, claude: "not_needed" }],
            requirements: 4,
            maxChars: 50000,
            extraCalls: 0,
          },
        }}
        project={{ repoRoot: "/r", prdFolder: "/p" }}
      />,
    );
    expect(scanButton().hasAttribute("disabled")).toBe(true);
    const note = document.getElementById(scanButton().getAttribute("aria-describedby") ?? "");
    expect(note?.textContent).toBe(KEY_MESSAGE.NO_KEY);
    expect(status()).toContain("Found 4 requirements in 1 PRD file.");
    await userEvent.click(screen.getByRole("button", { name: "Connect Claude" }));
    expect(onConnectAi).toHaveBeenCalledOnce();
  });

  it("while the connection is checked, Scan waits", () => {
    render(
      <AddProjectView
        {...base}
        ai={{ kind: "checking" }}
        repoFolder="/r"
        project={{ repoRoot: "/r", prdFolder: null }}
      />,
    );
    expect(scanButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Checking your Claude connection…")).toBeTruthy();
  });

  it("reading: busy, and Scan waits", () => {
    render(<AddProjectView {...base} repoFolder="/r" prdFolder="/p" prds={{ kind: "reading" }} />);
    expect(status()).toContain("Reading your PRDs…");
    expect(
      screen
        .getByRole("button", { name: "Change folder: PRD folder (optional)" })
        .getAttribute("aria-busy"),
    ).toBe("true");
    expect(scanButton().hasAttribute("disabled")).toBe(true);
  });

  it("an unreadable folder shows why, in words", () => {
    render(
      <AddProjectView
        {...base}
        repoFolder="/r"
        prdFolder="/p"
        prds={{ kind: "failed", message: READ_PRDS_MESSAGE.PATH_UNREADABLE }}
      />,
    );
    expect(status()).toContain("The PRD folder couldn't be read.");
    expect(screen.getByText(READ_PRDS_MESSAGE.PATH_UNREADABLE)).toBeTruthy();
    expect(screen.getByText("Choose a PRD folder AutoAI can read to scan.")).toBeTruthy();
    expect(scanButton().hasAttribute("disabled")).toBe(true);
  });
});

describe("Add project wording", () => {
  it("says 'Connect Claude to scan' when no key is saved (the requested words)", () => {
    expect(KEY_MESSAGE.NO_KEY).toBe("Connect Claude to scan.");
  });
});

describe("AddProject (with its hook)", () => {
  it("a saved key that cannot be read says why, keeps Scan off and offers the way back", async () => {
    installFakeBridge({
      "ai:status": () =>
        Promise.resolve<ChannelResponse<"ai:status">>({
          ok: false,
          error: { code: "SECRET_STORE_UNAVAILABLE", message: "no keychain" },
        }),
    });
    render(
      <AddProject
        folders={NONE}
        onFoldersChange={vi.fn()}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    expect(await screen.findByText(KEY_MESSAGE.SECRET_STORE_UNAVAILABLE)).toBeTruthy();
    expect(scanButton().hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Connect Claude" })).toBeTruthy();
  });

  it("a broken ai:status reply is said as a bug, and Scan stays off", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    installFakeBridge({ "ai:status": () => Promise.reject(new Error("contract broken")) });
    render(
      <AddProject
        folders={NONE}
        onFoldersChange={vi.fn()}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(status()).toContain("Something went wrong inside AutoAI");
    });
    expect(scanButton().hasAttribute("disabled")).toBe(true);
  });

  it("folders kept from an earlier visit show again, and the PRD folder is read again", async () => {
    const bridge = installFakeBridge({
      "ai:status": connected,
      "project:read-prds": () => Promise.resolve(summary([["cart.md", 3]])),
    });
    const onFoldersChange = vi.fn();
    render(
      <AddProject
        folders={{ repoFolder: "/r", prdFolder: "/p" }}
        onFoldersChange={onFoldersChange}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    expect(screen.getByText("/r")).toBeTruthy();
    await waitFor(() => {
      expect(status()).toContain("Found 3 requirements in 1 PRD file.");
    });
    expect(bridge.calls.filter((c) => c.channel === "project:read-prds")).toStrictEqual([
      { channel: "project:read-prds", request: { prdFolder: "/p" } },
    ]);
    expect(scanButton().hasAttribute("disabled")).toBe(false);
  });

  it("folders come only from the dialog; the chosen PRD folder is read at once, and Scan gets both", async () => {
    const picks: (string | null)[] = ["/work/shop", "/work/shop/docs"];
    const bridge = installFakeBridge({
      "ai:status": connected,
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () => Promise.resolve(summary([["cart.md", 3]])),
    });
    const onScan = vi.fn();
    render(
      <AddProject folders={NONE} onFoldersChange={vi.fn()} onConnectAi={vi.fn()} onScan={onScan} />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Choose folder: Project folder" }));
    await screen.findByText("/work/shop");
    await userEvent.click(
      screen.getByRole("button", { name: "Choose folder: PRD folder (optional)" }),
    );
    await waitFor(() => {
      expect(status()).toContain("Found 3 requirements in 1 PRD file.");
    });
    await userEvent.click(scanButton());
    expect(onScan).toHaveBeenCalledWith({ repoRoot: "/work/shop", prdFolder: "/work/shop/docs" });
    expect(bridge.calls).toStrictEqual([
      { channel: "ai:status", request: {} },
      { channel: "project:pick-folder", request: { purpose: "repo" } },
      { channel: "project:pick-folder", request: { purpose: "prds" } },
      { channel: "project:read-prds", request: { prdFolder: "/work/shop/docs" } },
    ]);
  });

  it("a cancelled dialog keeps the folder chosen before", async () => {
    const picks: (string | null)[] = ["/work/shop", null];
    installFakeBridge({
      "ai:status": connected,
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
    });
    render(
      <AddProject
        folders={NONE}
        onFoldersChange={vi.fn()}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    const choose = screen.getByRole("button", { name: "Choose folder: Project folder" });
    await userEvent.click(choose);
    await screen.findByText("/work/shop");
    await userEvent.click(screen.getByRole("button", { name: "Change folder: Project folder" }));
    await waitFor(() => {
      expect(screen.getByText("/work/shop")).toBeTruthy();
    });
  });

  it("no PRD files: NO_PRD_FILES becomes the 'no PRD files' state, and Scan scans the code alone", async () => {
    const picks: (string | null)[] = ["/r", "/empty"];
    installFakeBridge({
      "ai:status": connected,
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () =>
        Promise.resolve<ReadPrds>({
          ok: false,
          error: { code: "NO_PRD_FILES", message: "No PRD files (.md, .markdown, .txt) in /empty" },
        }),
    });
    const onScan = vi.fn();
    render(
      <AddProject folders={NONE} onFoldersChange={vi.fn()} onConnectAi={vi.fn()} onScan={onScan} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Choose folder: Project folder" }));
    await screen.findByText("/r");
    await userEvent.click(
      screen.getByRole("button", { name: "Choose folder: PRD folder (optional)" }),
    );
    await screen.findByText("No PRD files in this folder");
    await userEvent.click(scanButton());
    // The folder as chosen: the scan service turns "no PRD files" into its warning.
    expect(onScan).toHaveBeenCalledWith({ repoRoot: "/r", prdFolder: "/empty" });
  });

  it("while the PRDs are read, choosing again is ignored (one read at a time)", async () => {
    const picks: (string | null)[] = ["/p"];
    installFakeBridge({
      "ai:status": connected,
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () => new Promise<ReadPrds>(() => undefined),
    });
    render(
      <AddProject
        folders={NONE}
        onFoldersChange={vi.fn()}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Choose folder: PRD folder (optional)" }),
    );
    const again = await screen.findByRole("button", {
      name: "Change folder: PRD folder (optional)",
    });
    await waitFor(() => {
      expect(again.getAttribute("aria-busy")).toBe("true");
    });
    await userEvent.click(again);
    expect(picks).toStrictEqual([]);
    expect(status()).toContain("Reading your PRDs…");
  });

  it("a PRD folder that could not be read blocks Scan until the user picks again", async () => {
    const picks: (string | null)[] = ["/r", "/locked"];
    installFakeBridge({
      "ai:status": connected,
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () =>
        Promise.resolve<ReadPrds>({
          ok: false,
          error: { code: "PATH_UNREADABLE", message: "EACCES" },
        }),
    });
    render(
      <AddProject
        folders={NONE}
        onFoldersChange={vi.fn()}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Choose folder: Project folder" }));
    await screen.findByText("/r");
    await userEvent.click(
      screen.getByRole("button", { name: "Choose folder: PRD folder (optional)" }),
    );
    await waitFor(() => {
      expect(screen.getByText(READ_PRDS_MESSAGE.PATH_UNREADABLE)).toBeTruthy();
    });
    expect(scanButton().hasAttribute("disabled")).toBe(true);
  });

  it("no key saved: folders and PRDs still work, Scan stays disabled, and scan:run is never called", async () => {
    const picks: (string | null)[] = ["/r", "/p"];
    const bridge = installFakeBridge({
      "ai:status": () =>
        Promise.resolve<ChannelResponse<"ai:status">>({ ok: true, value: { configured: false } }),
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () => Promise.resolve(summary([["cart.md", 2]])),
    });
    render(
      <AddProject
        folders={NONE}
        onFoldersChange={vi.fn()}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    await screen.findByText("Connect Claude to scan.");
    await userEvent.click(screen.getByRole("button", { name: "Choose folder: Project folder" }));
    await screen.findByText("/r");
    await userEvent.click(
      screen.getByRole("button", { name: "Choose folder: PRD folder (optional)" }),
    );
    await waitFor(() => {
      expect(status()).toContain("Found 2 requirements in 1 PRD file.");
    });
    expect(scanButton().hasAttribute("disabled")).toBe(true);
    await userEvent.click(scanButton());
    expect(bridge.calls.map((c) => c.channel)).not.toContain("scan:run");
  });

  it("a broken reply says so instead of hanging", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    installFakeBridge({
      "ai:status": connected,
      "project:pick-folder": () => Promise.reject(new Error("contract broken")),
    });
    render(
      <AddProject
        folders={NONE}
        onFoldersChange={vi.fn()}
        onConnectAi={vi.fn()}
        onScan={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Choose folder: Project folder" }));
    await waitFor(() => {
      expect(status()).toContain("Something went wrong inside AutoAI");
    });
  });
});
