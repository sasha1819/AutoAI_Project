import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ChannelResponse } from "../../../contracts/channels.ts";
import { installFakeBridge, removeFakeBridge } from "../../app/testing/fake-bridge.ts";
import { ConnectAi, ConnectAiView, type ConnectAiViewProps } from "./ConnectAi.tsx";
import { SAVE_KEY_MESSAGE } from "./messages.ts";

const status = (configured: boolean) => () =>
  Promise.resolve<ChannelResponse<"ai:status">>({ ok: true, value: { configured } });
const saved = () =>
  Promise.resolve<ChannelResponse<"ai:save-key">>({ ok: true, value: { saved: true } });
const rejected = () =>
  Promise.resolve<ChannelResponse<"ai:save-key">>({
    ok: false,
    error: { code: "AI_AUTH_FAILED", message: "The Anthropic API rejected the API key." },
  });
const keyField = () => screen.getByLabelText<HTMLInputElement>("Anthropic API key");

afterEach(() => {
  removeFakeBridge();
});

describe("ConnectAiView", () => {
  const base: ConnectAiViewProps = {
    connection: "missing",
    keyText: "",
    onKeyTextChange: vi.fn(),
    onSave: vi.fn(),
    saving: false,
    replacing: false,
    onReplace: vi.fn(),
    onCancelReplace: vi.fn(),
    onContinue: vi.fn(),
    onOpenConsole: vi.fn(),
    onSetUpLater: vi.fn(),
  };

  it("no key yet: an empty password field, and Check and save waits for text", () => {
    render(<ConnectAiView {...base} />);
    expect(keyField().type).toBe("password");
    expect(keyField().value).toBe("");
    expect(keyField().getAttribute("autocomplete")).toBe("off");
    expect(screen.getByRole("button", { name: "Check and save" }).hasAttribute("disabled")).toBe(
      true,
    );
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("a rejected key: the reason under the field, read with it", () => {
    render(
      <ConnectAiView {...base} keyText="sk-wrong" error="Anthropic didn't accept this key." />,
    );
    expect(keyField().getAttribute("aria-invalid")).toBe("true");
    expect(keyField().getAttribute("aria-describedby")).toContain(
      screen.getByText("Anthropic didn't accept this key.").id,
    );
  });

  it("no key yet: Set up later goes on without one; it is not offered while replacing a key", async () => {
    const onSetUpLater = vi.fn();
    const { rerender } = render(<ConnectAiView {...base} onSetUpLater={onSetUpLater} />);
    await userEvent.click(screen.getByRole("button", { name: "Set up later" }));
    expect(onSetUpLater).toHaveBeenCalledOnce();
    rerender(<ConnectAiView {...base} keyText="sk-typed" saving />);
    expect(screen.getByRole("button", { name: "Set up later" }).hasAttribute("disabled")).toBe(
      true,
    );
    rerender(<ConnectAiView {...base} connection="connected" replacing />);
    expect(screen.queryByRole("button", { name: "Set up later" })).toBeNull();
  });

  it("connected: no key field at all, Continue, and a way to replace the key", () => {
    render(<ConnectAiView {...base} connection="connected" />);
    expect(screen.queryByLabelText("Anthropic API key")).toBeNull();
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("Connected");
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Replace key" })).toBeTruthy();
  });

  it("replacing: an empty field again, with Cancel", () => {
    render(<ConnectAiView {...base} connection="connected" replacing />);
    expect(keyField().value).toBe("");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("checking: busy, and the field stays as typed (read-only until the answer)", () => {
    render(<ConnectAiView {...base} keyText="sk-typed" saving />);
    expect(keyField().readOnly).toBe(true);
    expect(screen.getByRole("button", { name: "Check and save" }).getAttribute("aria-busy")).toBe(
      "true",
    );
    expect(keyField().value).toBe("sk-typed");
  });
});

describe("ConnectAi with the bridge", () => {
  it("checks the key before saving it: one save-key call with the typed key; then Connected, the field gone, Continue focused", async () => {
    const user = userEvent.setup();
    const fake = installFakeBridge({ "ai:status": status(false), "ai:save-key": saved });
    const onContinue = vi.fn();
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={onContinue} />);
    await user.type(await screen.findByLabelText("Anthropic API key"), "sk-ant-good");
    await user.click(screen.getByRole("button", { name: "Check and save" }));
    await waitFor(() => {
      expect(screen.getAllByRole("status")[0]?.textContent).toBe("Connected");
    });
    expect(fake.calls.map((c) => c.channel)).toStrictEqual(["ai:status", "ai:save-key"]);
    expect(fake.calls[1]?.request).toStrictEqual({ key: "sk-ant-good" });
    expect(screen.queryByLabelText("Anthropic API key")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("a rejected key: a clear inline error, focus back on the field, and no retry", async () => {
    const user = userEvent.setup();
    const fake = installFakeBridge({ "ai:status": status(false), "ai:save-key": rejected });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    await user.type(await screen.findByLabelText("Anthropic API key"), "sk-ant-wrong{Enter}");
    expect(await screen.findByText(SAVE_KEY_MESSAGE.AI_AUTH_FAILED)).toBeTruthy();
    expect(document.activeElement).toBe(keyField());
    // The error is final: one call, and the button waits for the user (no timer can fire a second one).
    expect(fake.calls.filter((c) => c.channel === "ai:save-key")).toHaveLength(1);
    expect(
      screen.getByRole("button", { name: "Check and save" }).getAttribute("aria-busy"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
  });

  it("a saved key is never asked for or shown: only ai:status is called, and there is no key field", async () => {
    const fake = installFakeBridge({ "ai:status": status(true) });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Continue" })).toBeTruthy();
    expect(screen.queryByLabelText("Anthropic API key")).toBeNull();
    expect(fake.calls.map((c) => c.channel)).toStrictEqual(["ai:status"]);
  });

  it("replacing a key starts from an empty field, and Cancel goes back without saving", async () => {
    const user = userEvent.setup();
    const fake = installFakeBridge({ "ai:status": status(true) });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Replace key" }));
    expect(keyField().value).toBe("");
    // The button that was used is gone: focus moves into the field; the old key is still the connected one.
    expect(document.activeElement).toBe(keyField());
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("Connected");
    await user.type(keyField(), "sk-half");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("Connected");
    await user.click(screen.getByRole("button", { name: "Replace key" }));
    expect(keyField().value).toBe("");
    expect(fake.calls.map((c) => c.channel)).toStrictEqual(["ai:status"]);
  });

  it("a rejected key, then Cancel and Replace again: an empty field with no old error", async () => {
    const user = userEvent.setup();
    installFakeBridge({ "ai:status": status(true), "ai:save-key": rejected });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Replace key" }));
    await user.type(keyField(), "sk-ant-wrong{Enter}");
    expect(await screen.findByText(SAVE_KEY_MESSAGE.AI_AUTH_FAILED)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Replace key" }));
    expect(screen.queryByText(SAVE_KEY_MESSAGE.AI_AUTH_FAILED)).toBeNull();
    expect(keyField().getAttribute("aria-invalid")).toBeNull();
  });

  it("a broken bridge (a reply that breaks its contract) never leaves the screen hanging", async () => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    installFakeBridge({
      "ai:status": () => Promise.reject(new Error("bad reply")),
      "ai:save-key": () => Promise.reject(new Error("bad reply")),
    });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    expect(await screen.findByText(/Something went wrong inside AutoAI/)).toBeTruthy();
    await user.type(keyField(), "sk-ant-any{Enter}");
    expect(await screen.findAllByText(/Something went wrong inside AutoAI/)).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Check and save" }).getAttribute("aria-busy"),
    ).toBeNull();
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it("replacing a key that is accepted: says the new key was saved", async () => {
    const user = userEvent.setup();
    installFakeBridge({ "ai:status": status(true), "ai:save-key": saved });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: "Replace key" }));
    await user.type(keyField(), "sk-ant-new{Enter}");
    expect(await screen.findByText("New key saved.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
  });

  it("no preload at all: the screen still moves on, and says so", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    expect(await screen.findByText(/Something went wrong inside AutoAI/)).toBeTruthy();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("no key yet: a help line opens the Anthropic Console in the browser (the allowlisted address only)", async () => {
    const user = userEvent.setup();
    const fake = installFakeBridge({
      "ai:status": status(false),
      "link:open": () =>
        Promise.resolve<ChannelResponse<"link:open">>({ ok: true, value: { opened: true } }),
    });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    await user.click(
      await screen.findByRole("button", {
        name: "Create one in the Anthropic Console (opens in your browser)",
      }),
    );
    expect(fake.calls.at(-1)).toStrictEqual({
      channel: "link:open",
      request: { url: "https://console.anthropic.com/" },
    });
  });

  it.each([
    [
      "the browser could not be opened",
      () =>
        Promise.resolve<ChannelResponse<"link:open">>({
          ok: false,
          error: { code: "LINK_NOT_OPENED", message: "x" },
        }),
      /Couldn't open your browser\. Go to console\.anthropic\.com/,
    ],
    [
      "a broken reply",
      () => Promise.reject(new Error("bad reply")),
      /Something went wrong inside AutoAI/,
    ],
  ] as const)("the Console link when %s: says so plainly", async (_name, answer, words) => {
    const user = userEvent.setup();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    installFakeBridge({ "ai:status": status(false), "link:open": answer });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    await user.click(
      await screen.findByRole("button", {
        name: "Create one in the Anthropic Console (opens in your browser)",
      }),
    );
    expect(await screen.findByText(words)).toBeTruthy();
    log.mockRestore();
  });

  it("the Console help line shows only while a key is being asked for", () => {
    installFakeBridge({ "ai:status": status(true) });
    render(
      <ConnectAiView
        {...{
          connection: "connected",
          keyText: "",
          onKeyTextChange: vi.fn(),
          onSave: vi.fn(),
          saving: false,
          replacing: false,
          onReplace: vi.fn(),
          onCancelReplace: vi.fn(),
          onContinue: vi.fn(),
          onOpenConsole: vi.fn(),
          onSetUpLater: vi.fn(),
        }}
      />,
    );
    expect(screen.queryByText(/Don't have a key/)).toBeNull();
  });

  it("says plainly that API usage is billed separately from a Claude subscription", () => {
    installFakeBridge({ "ai:status": status(false) });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    expect(
      screen.getByText(/billed by Anthropic, separately from any Claude Pro or Max subscription/),
    ).toBeTruthy();
  });

  it("a saved key that can't be read: says why, and asks for the key", async () => {
    installFakeBridge({
      "ai:status": () =>
        Promise.resolve<ChannelResponse<"ai:status">>({
          ok: false,
          error: { code: "SECRET_STORE_UNAVAILABLE", message: "no keyring" },
        }),
    });
    render(<ConnectAi onSetUpLater={vi.fn()} onContinue={vi.fn()} />);
    expect(await screen.findByText(/can't read a saved key/)).toBeTruthy();
    expect(keyField().value).toBe("");
  });
});
