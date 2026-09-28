export function createCart() {
  return { lines: [] };
}

export function addItem(cart, product) {
  const line = cart.lines.find((l) => l.productId === product.id);
  if (line) {
    line.quantity += 1;
  } else {
    cart.lines.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
    });
  }
}

export function removeItem(cart, productId) {
  cart.lines = cart.lines.filter((l) => l.productId !== productId);
}

export function isEmpty(cart) {
  return cart.lines.length === 0;
}

export function subtotal(cart) {
  return cart.lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
}
