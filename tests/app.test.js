import { describe, expect, it } from 'vitest';
import { addCartItem, cartCount, cartSubtotal, readCart, saveCart, updateCartItem, clearCart } from '../site/assets/js/cart.js';
import { escapeHTML, label, money } from '../site/assets/js/format.js';
import { validateCheckout } from '../site/assets/js/validation.js';

const sample = { id: 'dish-1', name: 'Hearth trout', category: 'mains', description: 'Fire cooked', price: 24 };
const storageMock = (initial = null) => {
  const values = new Map(initial ? [['ember-cart', initial]] : []);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

describe('cart module', () => {
  it('adds new items and increments matching items', () => {
    const one = addCartItem([], sample);
    expect(one[0].quantity).toBe(1);
    expect(addCartItem(one, sample)[0].quantity).toBe(2);
  });

  it('updates, caps, and removes quantities', () => {
    const one = addCartItem([], sample);
    expect(updateCartItem(one, sample.id, 3)[0].quantity).toBe(3);
    expect(updateCartItem(one, sample.id, 50)[0].quantity).toBe(20);
    expect(updateCartItem(one, sample.id, 0)).toEqual([]);
  });

  it('calculates count and subtotal', () => {
    const items = [{ ...sample, quantity: 2 }];
    expect(cartCount(items)).toBe(2);
    expect(cartSubtotal(items)).toBe(48);
  });

  it('saves, reloads, handles invalid storage, and clears', () => {
    const storage = storageMock();
    saveCart([{ ...sample, quantity: 1 }], storage);
    expect(readCart(storage)).toHaveLength(1);
    expect(readCart(storageMock('{'))).toEqual([]);
    clearCart(storage);
    expect(readCart(storage)).toEqual([]);
  });
});

describe('formatting module', () => {
  it('formats currency and labels', () => {
    expect(money(12)).toBe('$12.00');
    expect(label('out-for-delivery')).toBe('Out For Delivery');
  });

  it('escapes values before inserting them into HTML', () => {
    expect(escapeHTML(`<img src='x'>`)).toBe('&lt;img src=&#39;x&#39;&gt;');
  });
});

describe('checkout validation', () => {
  const valid = { name: 'Avery Guest', phone: '+1 (503) 555-0123', address: '428 Alder Street', fulfillment: 'delivery' };

  it('accepts valid delivery and pickup details', () => {
    expect(validateCheckout(valid)).toBeNull();
    expect(validateCheckout({ ...valid, fulfillment: 'pickup', address: '' })).toBeNull();
  });

  it('rejects short names, invalid phone numbers, and incomplete delivery addresses', () => {
    expect(validateCheckout({ ...valid, name: 'A' })).toMatch(/name/i);
    expect(validateCheckout({ ...valid, phone: '123' })).toMatch(/phone/i);
    expect(validateCheckout({ ...valid, address: 'Short' })).toMatch(/address/i);
  });
});
