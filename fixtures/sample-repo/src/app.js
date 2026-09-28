import { addItem, createCart, isEmpty, removeItem, subtotal } from "./cart/cart.js";
import { discountAmount, findDiscount } from "./cart/discounts.js";
import { products } from "./catalog.js";
import { canPlaceOrder } from "./checkout/place-order.js";
import { shippingFee } from "./checkout/shipping.js";
import { formatMoney } from "./money.js";

const cart = createCart();
let discount = null;

const $ = (id) => document.getElementById(id);

function button(label, ariaLabel, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.setAttribute("aria-label", ariaLabel);
  b.addEventListener("click", onClick);
  return b;
}

function renderProducts() {
  for (const product of products) {
    const li = document.createElement("li");
    li.append(`${product.name} ${formatMoney(product.price)}`);
    li.append(
      button("Add to cart", `Add ${product.name} to cart`, () => {
        addItem(cart, product);
        render();
      }),
    );
    $("products").append(li);
  }
}

function render() {
  $("cart-empty").hidden = !isEmpty(cart);
  $("cart-lines").replaceChildren(
    ...cart.lines.map((line) => {
      const li = document.createElement("li");
      li.dataset.testid = "cart-line";
      li.append(`${line.name} × ${line.quantity}`);
      li.append(
        button("Remove", `Remove ${line.name}`, () => {
          removeItem(cart, line.productId);
          render();
        }),
      );
      return li;
    }),
  );

  const sub = subtotal(cart);
  const off = discountAmount(sub, discount);
  const shipping = shippingFee(sub);
  $("subtotal").textContent = formatMoney(sub);
  $("discount").textContent = formatMoney(off);
  $("shipping").textContent = formatMoney(shipping);
  $("total").textContent = formatMoney(sub - off + shipping);
  $("place-order").disabled = !canPlaceOrder(cart, $("email").value);
}

$("discount-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const found = findDiscount($("discount-code").value);
  discount = found ?? discount;
  $("discount-message").textContent = found
    ? `Discount ${found.code} applied`
    : "Unknown discount code";
  render();
});

$("email").addEventListener("input", render);

$("checkout-form").addEventListener("submit", (event) => {
  event.preventDefault();
  $("order-confirmation").textContent = "Thanks! Your order is placed.";
});

renderProducts();
render();
