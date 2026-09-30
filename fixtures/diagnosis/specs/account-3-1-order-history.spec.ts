// AutoAI requirement: Account 3.1
import { expect, test } from "@playwright/test";

test("Signed-in customers see their order history", async ({ page }) => {
  await page.goto("/account?session=d41d8cd98f00b204e980");
  await expect(page.getByRole("heading", { name: "Order history" })).toBeVisible();
});
