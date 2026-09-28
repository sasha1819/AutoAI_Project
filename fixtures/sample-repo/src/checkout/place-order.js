import { isEmpty } from "../cart/cart.js";

export function canPlaceOrder(cart, email) {
  return !isEmpty(cart) && email.trim() !== "";
}
