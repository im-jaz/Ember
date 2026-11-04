import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const item = { id: 'carrots', name: 'Hearth carrots', category: 'small-plates', description: 'Whipped ricotta', price: 12, image: './images/menu1.jpg', available: true, featured: true };
const order = { id: 'order-1', orderNumber: 'EMB-TEST-100', customerName: 'Avery Guest', phone: '+1 (503) 555-0123', fulfillment: 'pickup', items: [{ ...item, quantity: 1 }], total: 12, status: 'pending' };

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  sessionStorage.clear();
  document.body.replaceChildren();
  globalThis.EMBER_API_BASE = 'http://localhost:3000/api';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Test API error' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.EMBER_API_BASE;
});

async function start(page, markup) {
  document.body.dataset.page = page;
  document.body.innerHTML = markup;
  await import('../app.js');
  await vi.waitFor(() => expect(document.body.dataset.page).toBe(page));
}

const cartData = [{ ...item, quantity: 1 }];

describe('application page flows', () => {
  it('renders an empty cart state', async () => {
    await start('cart', '<div data-cart-view></div>');
    expect(document.querySelector('[data-cart-view]').textContent).toContain('Your cart is empty');
  });

  it('updates and removes cart line quantities', async () => {
    localStorage.setItem('ember-cart', JSON.stringify(cartData));
    await start('cart', '<span data-cart-count></span><div data-cart-view></div>');
    document.querySelector('[data-quantity="1"]').click();
    expect(JSON.parse(localStorage.getItem('ember-cart'))[0].quantity).toBe(2);
    document.querySelector('[data-remove-item]').click();
    expect(JSON.parse(localStorage.getItem('ember-cart'))).toEqual([]);
  });

  it('renders checkout empty state', async () => {
    await start('checkout', '<div data-checkout-view></div>');
    expect(document.querySelector('[data-checkout-view]').textContent).toContain('Nothing to check out yet');
  });

  it('rerenders checkout for pickup and reports an API submission error', async () => {
    localStorage.setItem('ember-cart', JSON.stringify(cartData));
    await start('checkout', '<div data-checkout-view></div>');
    document.querySelector('[data-fulfillment="pickup"]').click();
    expect(document.querySelector('[name="address"]')).toBeNull();
    document.querySelector('[name="name"]').value = 'Avery Guest';
    document.querySelector('[name="phone"]').value = '+1 (503) 555-0123';
    document.querySelector('[data-checkout-form]').requestSubmit();
    await vi.waitFor(() => expect(document.querySelector('[data-checkout-error]').textContent).toBe('Test API error'));
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/orders', expect.objectContaining({ method: 'POST' }));
  });

  it('shows checkout validation messages without making a request', async () => {
    localStorage.setItem('ember-cart', JSON.stringify(cartData));
    await start('checkout', '<div data-checkout-view></div>');
    document.querySelector('[data-checkout-form]').requestSubmit();
    expect(document.querySelector('[data-checkout-error]').textContent).toMatch(/full name/i);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders a confirmation fallback when no recent order exists', async () => {
    await start('confirmation', '<div data-confirmation-view></div>');
    expect(document.querySelector('[data-confirmation-view]').textContent).toContain('No recent order found');
  });

  it('renders a saved order confirmation and tracking link', async () => {
    sessionStorage.setItem('ember-last-order', JSON.stringify(order));
    await start('confirmation', '<div data-confirmation-view></div>');
    expect(document.querySelector('[data-confirmation-view]').textContent).toContain('EMB-TEST-100');
    expect(document.querySelector('[data-confirmation-view] a').href).toContain('tracking.html');
  });

  it('loads tracking query values and shows API errors', async () => {
    document.body.dataset.page = 'tracking';
    document.body.innerHTML = '<form data-tracking-form><input name="orderNumber"><input name="phone"></form><p data-tracking-message></p><div data-tracking-result></div>';
    window.history.replaceState({}, '', '/tracking.html?orderNumber=EMB-TEST-100&phone=%2B1%20(503)%20555-0123');
    await import('../app.js');
    expect(document.querySelector('[name="orderNumber"]').value).toBe('EMB-TEST-100');
    document.querySelector('[data-tracking-form]').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.querySelector('[data-tracking-message]').textContent).toContain('Test API error'));
  });

  it('shows staff login when protected dashboard API is unavailable', async () => {
    await start('dashboard', '<div data-dashboard-view></div>');
    expect(document.querySelector('[data-staff-login]')).not.toBeNull();
  });
});
