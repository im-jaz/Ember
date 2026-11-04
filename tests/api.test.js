import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let api;
let fetchMock;
let storage;

beforeEach(async () => {
  vi.resetModules();
  globalThis.EMBER_API_BASE = 'https://ember.test/api';
  storage = {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
  fetchMock = vi.fn(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }));
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('fetch', fetchMock);
  api = await import('../api.js');
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.EMBER_API_BASE;
});

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('API client REST methods', () => {
  it('uses GET for menu and employee order reads', async () => {
    fetchMock.mockResolvedValue(jsonResponse([]));
    await api.getMenu();
    await api.getEmployeeOrders();
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method || 'GET'])).toEqual([
      ['https://ember.test/api/menu-items', 'GET'],
      ['https://ember.test/api/employee-orders', 'GET'],
    ]);
  });

  it('uses POST to create orders and staff sessions', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'order-1' }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: 'staff-token' }));
    const order = { customerName: 'Avery', items: [{ menuItem: 'dish-1', quantity: 1 }] };
    await api.createOrder(order);
    await api.staffLogin('staff', 'pass');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(order);
    expect(fetchMock.mock.calls[1][1].method).toBe('POST');
    expect(storage.setItem).toHaveBeenCalledWith('ember-staff-token', 'staff-token');
  });

  it('uses PUT, PATCH, and DELETE for employee order changes', async () => {
    storage.getItem.mockReturnValue('staff-token');
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));
    await api.replaceOrder('order/1', { fulfillment: 'pickup' });
    await api.patchOrder('order/1', { status: 'ready' });
    await api.deleteOrder('order/1');
    expect(fetchMock.mock.calls.map(([url, init]) => [url, init.method])).toEqual([
      ['https://ember.test/api/employee-orders/order%2F1', 'PUT'],
      ['https://ember.test/api/employee-orders/order%2F1', 'PATCH'],
      ['https://ember.test/api/employee-orders/order%2F1', 'DELETE'],
    ]);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer staff-token');
  });

  it('encodes order tracking query parameters', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ status: 'pending' }));
    await api.trackOrder('EMB/123', '+1 (503) 555-0123');
    expect(fetchMock.mock.calls[0][0]).toBe('https://ember.test/api/order-tracking?orderNumber=EMB%2F123&phone=%2B1%20(503)%20555-0123');
  });

  it('surfaces server and network errors to the caller', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Invalid order.' }, 400));
    await expect(api.createOrder({})).rejects.toThrow('Invalid order.');
    fetchMock.mockRejectedValueOnce(new TypeError('offline'));
    await expect(api.createOrder({})).rejects.toThrow(/API is not reachable/);
  });
});
