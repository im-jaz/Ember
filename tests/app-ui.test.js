import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const menuItems = [
  { id: 'carrots', name: 'Hearth carrots', category: 'small-plates', description: 'Whipped ricotta', price: 12, image: './images/menu1.jpg', available: true, featured: true },
  { id: 'trout', name: 'Wood-fired trout', category: 'mains', description: 'Charred lemon', price: 28, image: './images/menu2.jpeg', available: true, featured: true },
];

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = `
    <header><span data-cart-count>0</span></header>
    <div data-featured-menu></div>
    <p data-menu-status></p>
    <div class="category-list">
      <button class="category-chip is-active" data-category="all">All</button>
      <button class="category-chip" data-category="mains">Mains</button>
    </div>
    <input id="menu-search">
    <div data-menu-items></div>`;
  document.body.dataset.page = 'menu';
  globalThis.EMBER_API_BASE = 'http://localhost:3000/api';
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(menuItems), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.EMBER_API_BASE;
  document.body.replaceChildren();
});

async function startApp() {
  await import('../app.js');
  await vi.waitFor(() => expect(document.querySelectorAll('.menu-card')).toHaveLength(2));
}

describe('menu UI', () => {
  it('loads API menu and featured cards, filters by category and search', async () => {
    await startApp();
    expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/menu-items', expect.any(Object));
    expect(document.querySelectorAll('.signature-card')).toHaveLength(2);
    document.querySelector('[data-category="mains"]').click();
    expect(document.querySelectorAll('.menu-card')).toHaveLength(1);
    expect(document.querySelector('.menu-card h2').textContent).toBe('Wood-fired trout');
    document.querySelector('[data-category="all"]').click();
    document.querySelector('#menu-search').value = 'ricotta';
    document.querySelector('#menu-search').dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.menu-card')).toHaveLength(1);
  });

  it('adds selected menu items to persistent cart and updates count', async () => {
    await startApp();
    document.querySelector('[data-add-item="carrots"]').click();
    expect(document.querySelector('[data-cart-count]').textContent).toBe('1');
    expect(JSON.parse(localStorage.getItem('ember-cart'))[0]).toMatchObject({ id: 'carrots', quantity: 1 });
  });

  it('falls back to the bundled menu if the API request fails', async () => {
    fetch.mockRejectedValueOnce(new TypeError('offline'));
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(menuItems), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    await startApp();
    expect(document.querySelectorAll('.menu-card')).toHaveLength(2);
  });
});
