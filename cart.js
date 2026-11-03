const STORAGE_KEY = 'ember-cart';

export function readCart(storage = globalThis.localStorage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter((line) => line && line.id && Number(line.quantity) > 0) : [];
  } catch {
    return [];
  }
}

export function saveCart(items, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function addCartItem(items, item) {
  const found = items.find((line) => String(line.id) === String(item.id));
  return found
    ? items.map((line) => String(line.id) === String(item.id) ? { ...line, quantity: line.quantity + 1 } : line)
    : [...items, { ...item, quantity: 1 }];
}

export function updateCartItem(items, id, quantity) {
  const amount = Math.max(0, Math.min(20, Number(quantity) || 0));
  return amount < 1
    ? items.filter((line) => String(line.id) !== String(id))
    : items.map((line) => String(line.id) === String(id) ? { ...line, quantity: amount } : line);
}

export const cartCount = (items) => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
export const cartSubtotal = (items) => items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
export const clearCart = (storage = globalThis.localStorage) => storage.removeItem(STORAGE_KEY);
