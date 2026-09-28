// Proves the sample shop really behaves the way expected-findings.json says: the two correct features work,
// the three planted mismatches are real, and the app is servable for Playwright. Lives outside sample-repo on
// purpose, so the scan engine never reads these hints.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addItem, createCart, isEmpty, removeItem } from "./sample-repo/src/cart/cart.js";
import { findDiscount } from "./sample-repo/src/cart/discounts.js";
import { canPlaceOrder } from "./sample-repo/src/checkout/place-order.js";
import { shippingFee } from "./sample-repo/src/checkout/shipping.js";

const mug = { id: "mug", name: "Coffee mug", price: 12.5 };
const cartWithMug = () => {
  const cart = createCart();
  addItem(cart, mug);
  return cart;
};

describe("correct features", () => {
  it("Cart 1.1: adding the same product again raises its quantity", () => {
    const cart = cartWithMug();
    addItem(cart, mug);
    expect(cart.lines).toEqual([
      { productId: "mug", name: "Coffee mug", price: 12.5, quantity: 2 },
    ]);
  });

  it("Cart 1.3: removing the last item leaves the cart empty (render shows the empty message)", () => {
    const cart = cartWithMug();
    removeItem(cart, "mug");
    expect(isEmpty(cart)).toBe(true);
  });
});

describe("planted mismatches are real", () => {
  it("Cart 1.2: a lower-case discount code is rejected", () => {
    expect(findDiscount("SAVE10")).not.toBeNull();
    expect(findDiscount("save10")).toBeNull();
  });

  it.each([
    [0, 0],
    [49.99, 5],
    [50, 5],
    [50.01, 0],
  ])(
    "Shipping 2.1: a subtotal of %d pays %d shipping (exactly 50 should be free)",
    (subtotal, fee) => {
      expect(shippingFee(subtotal)).toBe(fee);
    },
  );

  it("checkout.md section 1: an invalid email still enables Place order", () => {
    expect(canPlaceOrder(cartWithMug(), "not-an-email")).toBe(true);
    expect(canPlaceOrder(cartWithMug(), "  ")).toBe(false);
    expect(canPlaceOrder(createCart(), "a@b.co")).toBe(false);
  });
});

describe("the sample shop serves", () => {
  it("the page and its modules, and nothing else", async () => {
    const server = spawn(
      process.execPath,
      [join(import.meta.dirname, "sample-repo", "server.mjs")],
      {
        env: { ...process.env, PORT: "0" },
      },
    );
    try {
      const base = await new Promise((resolve, reject) => {
        server.stdout.on("data", (d) => {
          const m = /http:\/\/localhost:\d+/.exec(String(d));
          if (m) resolve(m[0]);
        });
        server.on("exit", (code) => reject(new Error(`server exited with ${code}`)));
      });
      const page = await fetch(`${base}/`);
      expect(await page.text()).toContain("<h1>Sample Shop</h1>");
      const app = await fetch(`${base}/src/app.js`);
      expect(app.status).toBe(200);
      expect(app.headers.get("content-type")).toBe("text/javascript");
      expect((await fetch(`${base}/package.json`)).status).toBe(404);
      expect((await fetch(`${base}/src/../server.mjs`)).status).toBe(404);
    } finally {
      server.kill();
    }
  });
});
