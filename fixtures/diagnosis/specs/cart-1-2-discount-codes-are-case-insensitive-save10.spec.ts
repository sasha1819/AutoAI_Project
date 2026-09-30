// AutoAI requirement: Cart 1.2
import { expect, test } from "@playwright/test";

test("Applies 10% discount when entering the code in lowercase (save10)", async ({ page }) => {
  await page.goto("/");

  const addButton = page.getByRole("button", { name: /Add .* to cart/i }).first();
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();

  const subtotalLocator = page.locator("#subtotal");
  await expect(subtotalLocator).not.toHaveText("$0.00");

  const subtotalText = await subtotalLocator.textContent();
  const subtotalValue = parseFloat((subtotalText ?? "").replace(/[^0-9.]/g, ""));
  const expectedDiscount = Math.round(subtotalValue * 0.1 * 100) / 100;
  const expectedDiscountText = `$${expectedDiscount.toFixed(2)}`;

  await page.getByLabel("Discount code").fill("save10");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page.getByText("Unknown discount code")).not.toBeVisible();
  await expect(page.locator("#discount")).toHaveText(expectedDiscountText);
});
