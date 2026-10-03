import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WelcomeView } from "./Welcome.tsx";

describe("Welcome", () => {
  it("names the app as the page's one top heading and says what it does", () => {
    render(<WelcomeView onGetStarted={vi.fn()} />);
    expect(screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent)).toStrictEqual([
      "AutoAI",
    ]);
    expect(
      screen.getByText("Test your web application without writing a line of code."),
    ).toBeTruthy();
  });

  it("Get started works from the keyboard and by click", async () => {
    const user = userEvent.setup();
    const onGetStarted = vi.fn();
    render(<WelcomeView onGetStarted={onGetStarted} />);
    const button = screen.getByRole("button", { name: "Get started" });
    await user.tab();
    expect(button).toBe(document.activeElement);
    await user.keyboard("{Enter}");
    expect(onGetStarted).toHaveBeenCalledTimes(1);
    await user.click(button);
    expect(onGetStarted).toHaveBeenCalledTimes(2);
  });

  it("promises only what the MVP does: web apps, no other platforms", () => {
    const { container } = render(<WelcomeView onGetStarted={vi.fn()} />);
    for (const word of ["Mobile", "Desktop", "Native", "Hybrid"])
      expect(container.textContent).not.toContain(word);
  });
});
