import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelResponse } from "../../../contracts/channels.ts";
import { installFakeBridge, removeFakeBridge } from "../../app/testing/fake-bridge.ts";
import { AddProject, AddProjectView, type AddProjectViewProps } from "./AddProject.tsx";
import { READ_PRDS_MESSAGE } from "./messages.ts";

type ReadPrds = ChannelResponse<"project:read-prds">;
const summary = (files: [string, number][]): ReadPrds => ({
  ok: true,
  value: {
    files: files.map(([file, requirements]) => ({ file, requirements })),
    requirements: files.reduce((n, [, r]) => n + r, 0),
  },
});
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

  it("PRDs in plain prose: says 0 requirements and how to write them, never an empty result", () => {
    render(
      <AddProjectView
        {...base}
        repoFolder="/r"
        prdFolder="/p"
        prds={{
          kind: "read",
          summary: { files: [{ file: "vision.md", requirements: 0 }], requirements: 0 },
        }}
        project={{ repoRoot: "/r", prdFolder: "/p" }}
      />,
    );
    expect(status()).toContain("No requirements found in 1 PRD file.");
    expect(screen.getByText("No requirements found")).toBeTruthy();
    expect(
      screen.getByText(/found no requirements in it\. AutoAI finds requirements under headings/),
    ).toBeTruthy();
    expect(screen.getByText(/the scan only reads your code\. It makes no AI calls\./)).toBeTruthy();
    expect(screen.queryByRole("list", { name: "PRD files" })).toBeNull();
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
              { file: "cart.md", requirements: 12 },
              { file: "notes.md", requirements: 0 },
            ],
            requirements: 12,
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
      "notes.md · 0 requirements",
    ]);
    expect(screen.getByText(/No requirements in notes\.md\./)).toBeTruthy();
    expect(screen.getByText(/using your API key \(billed by Anthropic\)/)).toBeTruthy();
    scanButton().click();
    expect(onScan).toHaveBeenCalledWith({ repoRoot: "/r", prdFolder: "/p" });
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

describe("AddProject (with its hook)", () => {
  it("folders come only from the dialog; the chosen PRD folder is read at once, and Scan gets both", async () => {
    const picks: (string | null)[] = ["/work/shop", "/work/shop/docs"];
    const bridge = installFakeBridge({
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () => Promise.resolve(summary([["cart.md", 3]])),
    });
    const onScan = vi.fn();
    render(<AddProject onScan={onScan} />);
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
      { channel: "project:pick-folder", request: { purpose: "repo" } },
      { channel: "project:pick-folder", request: { purpose: "prds" } },
      { channel: "project:read-prds", request: { prdFolder: "/work/shop/docs" } },
    ]);
  });

  it("a cancelled dialog keeps the folder chosen before", async () => {
    const picks: (string | null)[] = ["/work/shop", null];
    installFakeBridge({
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
    });
    render(<AddProject onScan={vi.fn()} />);
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
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () =>
        Promise.resolve<ReadPrds>({
          ok: false,
          error: { code: "NO_PRD_FILES", message: "No PRD files (.md, .markdown, .txt) in /empty" },
        }),
    });
    const onScan = vi.fn();
    render(<AddProject onScan={onScan} />);
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
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () => new Promise<ReadPrds>(() => undefined),
    });
    render(<AddProject onScan={vi.fn()} />);
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
      "project:pick-folder": () => Promise.resolve({ path: picks.shift() ?? null }),
      "project:read-prds": () =>
        Promise.resolve<ReadPrds>({
          ok: false,
          error: { code: "PATH_UNREADABLE", message: "EACCES" },
        }),
    });
    render(<AddProject onScan={vi.fn()} />);
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

  it("a broken reply says so instead of hanging", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    installFakeBridge({
      "project:pick-folder": () => Promise.reject(new Error("contract broken")),
    });
    render(<AddProject onScan={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Choose folder: Project folder" }));
    await waitFor(() => {
      expect(status()).toContain("Something went wrong inside AutoAI");
    });
  });
});
