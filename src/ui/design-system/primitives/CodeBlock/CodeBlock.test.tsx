import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./CodeBlock.tsx";

const code = 'test("adds to cart", async () => {\n  await page.goto("/");\n});\n';

describe("CodeBlock", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("is a named, keyboard-reachable scroll area holding exactly the code", () => {
    render(<CodeBlock label="Example code" code={code} />);
    const region = screen.getByRole("region", { name: "Example code" });
    expect(region.tabIndex).toBe(0);
    expect(region.querySelector("code")?.textContent).toBe(code.slice(0, -1));
  });

  it("line numbers sit in their own column, hidden from screen readers", () => {
    const { container } = render(<CodeBlock label="Example code" code={code} />);
    const numbers = container.querySelector("[aria-hidden=true]");
    expect(numbers?.textContent).toBe("123");
    expect(numbers?.className).toContain("select-none");
  });

  it("can leave out line numbers and the copy button", () => {
    const { container } = render(
      <CodeBlock label="Example code" code="one line" lineNumbers={false} copyable={false} />,
    );
    expect(container.querySelector("[aria-hidden=true]")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("copies the code exactly and says so, then goes back to Copy", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime.bind(vi) });
    render(<CodeBlock label="Example code" code={code} />);
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(await navigator.clipboard.readText()).toBe(code);
    expect(screen.getByRole("status").textContent).toBe("Copied");
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: "Copy code" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("says when copying fails, out loud and on the button", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<CodeBlock label="Example code" code={code} />);
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(screen.getByRole("status").textContent).toBe("Copy failed");
    expect(screen.getByRole("button", { name: "Copy failed" })).toBeTruthy();
  });

  it("copying again announces it again", async () => {
    const user = userEvent.setup();
    render(<CodeBlock label="Example code" code={code} />);
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    const button = screen.getByRole("button", { name: "Copied" });
    const said: string[] = [];
    const observer = new MutationObserver(() => said.push(screen.getByRole("status").textContent));
    observer.observe(screen.getByRole("status"), {
      childList: true,
      characterData: true,
      subtree: true,
    });
    await user.click(button);
    observer.disconnect();
    expect(said).toContain("");
    expect(screen.getByRole("status").textContent).toBe("Copied");
  });

  it("a missing clipboard counts as a failure", async () => {
    const user = userEvent.setup();
    const real = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<CodeBlock label="Example code" code={code} />);
    await user.click(screen.getByRole("button", { name: "Copy code" }));
    expect(screen.getByRole("status").textContent).toBe("Copy failed");
    if (real !== undefined) Object.defineProperty(navigator, "clipboard", real);
  });

  it("one trailing newline adds no extra line", () => {
    const { container } = render(<CodeBlock label="Example code" code={"a\nb\n"} />);
    expect(container.querySelector("[aria-hidden=true]")?.textContent).toBe("12");
  });

  // The ts-expect-error lines are checked at typecheck time (part of verify); blank values also throw at runtime.
  it("must be named and have code; closed props", () => {
    const blank: string = " ";
    expect(() => render(<CodeBlock label={blank} code="x" />)).toThrow(
      "CodeBlock needs a non-empty label",
    );
    expect(() => render(<CodeBlock label="A" code={"\n  \n"} />)).toThrow("CodeBlock needs code");
    // @ts-expect-error code without a name
    expect(() => render(<CodeBlock code="x" />)).toThrow(/label/);
    // @ts-expect-error closed props: no className
    render(<CodeBlock label="B" code="x" className="y" />);
    expect(screen.getByRole("region", { name: "B" })).toBeTruthy();
  });
});
