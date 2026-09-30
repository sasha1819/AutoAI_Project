// AutoAI requirement: Cart 1.1
import { expect, test } from "@playwright/test";

test("Adding the same product twice shows one cart line with quantity 2", async ({ page }) => {
  test.setTimeout(10_000);
  await page.goto("/");

  const addButton = page.getByRole("button", { name: "Add Coffee mug to basket" });
  await addButton.click();
  await addButton.click();

  await expect(page.getByTestId("cart-line")).toHaveCount(1);
});
