const API_BASE = (globalThis.EMBER_API_BASE || `${window.location.origin}/api`).replace(/\/$/, '');
const TOKEN_KEY = 'ember-staff-token';

async function request(path, init = {}) {
  const headers = { Accept: 'application/json', ...init.headers };
  if (init.body) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || body.error || 'Something went wrong. Please try again.');
  return body;
}

export const getMenu = () => request('/menu-items');
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
