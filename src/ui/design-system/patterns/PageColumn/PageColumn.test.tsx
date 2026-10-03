import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageColumn } from "./PageColumn.tsx";

describe("PageColumn", () => {
  it("puts its content in one centred column of the page width", () => {
    render(
      <PageColumn>
        <h1>Title</h1>
      </PageColumn>,
    );
    const column = screen.getByRole("heading", { name: "Title" }).parentElement;
    expect(column?.className).toContain("max-w-215");
    expect(column?.className).toContain("mx-auto");
  });
});
