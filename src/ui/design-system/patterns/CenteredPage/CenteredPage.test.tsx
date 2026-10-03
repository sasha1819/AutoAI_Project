import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CenteredPage } from "./CenteredPage.tsx";

describe("CenteredPage", () => {
  it("centres its content and puts the footer last", () => {
    const { container } = render(
      <CenteredPage footer="A footer line">
        <h1>Title</h1>
      </CenteredPage>,
    );
    expect(screen.getByRole("heading", { name: "Title" }).parentElement?.className).toContain(
      "justify-center",
    );
    expect(container.firstElementChild?.lastElementChild?.textContent).toBe("A footer line");
  });

  it("has no footer area without a footer", () => {
    const { container } = render(
      <CenteredPage>
        <p>Only content</p>
      </CenteredPage>,
    );
    expect(container.firstElementChild?.children).toHaveLength(1);
  });
});
