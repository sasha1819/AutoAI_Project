export const SHIPPING_FEE = 5;
export const FREE_SHIPPING_FROM = 50;

export function shippingFee(subtotal) {
  if (subtotal === 0) return 0;
  return subtotal > FREE_SHIPPING_FROM ? 0 : SHIPPING_FEE;
}
