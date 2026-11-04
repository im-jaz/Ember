const API_BASE = (globalThis.EMBER_API_BASE || `${window.location.origin}/api`).replace(/\/$/, '');
const TOKEN_KEY = 'ember-staff-token';

async function request(path, init = {}) {
  const headers = { Accept: 'application/json', ...init.headers };
  if (init.body) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error('The ordering API is not reachable. Open this site through the running Node server, not a static preview.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body.message || body.error;
    if (message) throw new Error(message);
    if (response.status === 404) throw new Error('The ordering API was not found. This static host cannot process orders; use the deployed Node app.');
    throw new Error(`The ordering API returned an error (${response.status}). Please try again.`);
  }
  return body;
}

export const getMenu = async () => {
  try {
    return await request('/menu-items');
  } catch (error) {
    const response = await fetch(new URL('./menu-items.json', import.meta.url));
    if (!response.ok) throw error;
    return response.json();
  }
};
export const createOrder = (data) => request('/orders', { method: 'POST', body: JSON.stringify(data) });
export const trackOrder = (orderNumber, phone) => request(`/order-tracking?orderNumber=${encodeURIComponent(orderNumber)}&phone=${encodeURIComponent(phone)}`);
export const staffLogin = async (username, password) => {
  const result = await request('/staff/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  localStorage.setItem(TOKEN_KEY, result.token);
  return result;
};
export const staffLogout = () => localStorage.removeItem(TOKEN_KEY);
export const getEmployeeOrders = () => request('/employee-orders');
export const replaceOrder = (id, data) => request(`/employee-orders/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
export const patchOrder = (id, data) => request(`/employee-orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteOrder = (id) => request(`/employee-orders/${encodeURIComponent(id)}`, { method: 'DELETE' });
