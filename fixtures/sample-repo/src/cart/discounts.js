const codes = new Map([["SAVE10", 0.1]]);

export function findDiscount(input) {
  const code = input.trim();
  const rate = codes.get(code);
  return rate === undefined ? null : { code, rate };
}

export function discountAmount(amount, discount) {
  if (!discount) return 0;
  return Math.round(amount * discount.rate * 100) / 100;
}
