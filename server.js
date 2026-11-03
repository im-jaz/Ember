import crypto from 'node:crypto';
import { access, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import jsonServer from 'json-server';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = jsonServer.create();
const seedFile = path.join(__dirname, 'db.json');
const dataFile = process.env.DB_FILE || seedFile;
try {
  await access(dataFile);
} catch {
  await mkdir(path.dirname(dataFile), { recursive: true });
  await copyFile(seedFile, dataFile);
}
const router = jsonServer.router(dataFile);
const db = router.db;
const port = Number(process.env.PORT || 3000);
const staticRoot = path.join(__dirname, process.env.NODE_ENV === 'production' ? 'dist' : 'site');
const staffTokens = new Map();
const allowedStatuses = new Set(['pending', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled']);

if (process.env.NODE_ENV === 'production' && (!process.env.STAFF_USERNAME || !process.env.STAFF_PASSWORD)) {
  throw new Error('Set STAFF_USERNAME and STAFF_PASSWORD before starting in production.');
}

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || request.headers.origin || '*');
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  if (request.method === 'OPTIONS') return response.sendStatus(204);
  next();
});
app.use(jsonServer.bodyParser);
app.use(jsonServer.defaults({ static: staticRoot, logger: process.env.NODE_ENV !== 'production' }));

function sendError(response, status, message) {
  return response.status(status).json({ message });
}

function authenticated(request, response, next) {
  const token = request.get('authorization')?.replace(/^Bearer\s+/i, '');
  const expiresAt = token && staffTokens.get(token);
  if (!expiresAt || expiresAt <= Date.now()) {
    if (token) staffTokens.delete(token);
    return sendError(response, 401, 'Employee sign-in required.');
  }
  next();
}

app.post('/api/staff/login', (request, response) => {
  const username = String(request.body?.username || '');
  const password = String(request.body?.password || '');
  const expectedUsername = process.env.STAFF_USERNAME || 'string';
  const expectedPassword = process.env.STAFF_PASSWORD || 'string';
  if (username !== expectedUsername || password !== expectedPassword) return sendError(response, 401, 'Invalid username or password.');
  const token = crypto.randomBytes(32).toString('hex');
  staffTokens.set(token, Date.now() + 8 * 60 * 60 * 1000);
  return response.json({ token, expiresIn: 28800 });
});

app.get('/api/menu-items', (_request, response) => {
  const items = db.get('menu-items').value() || [];
  response.json(items.slice().sort((left, right) => Number(left.sortOrder || 0) - Number(right.sortOrder || 0)));
});

app.post('/api/orders', (request, response) => {
  const body = request.body || {};
  const customerName = String(body.customerName || '').trim().slice(0, 100);
  const phone = String(body.phone || '').trim().slice(0, 30);
  const fulfillment = body.fulfillment === 'pickup' ? 'pickup' : 'delivery';
  const address = fulfillment === 'delivery' ? String(body.address || '').trim().slice(0, 300) : '';
  const notes = String(body.notes || '').trim().slice(0, 500);
  if (customerName.length < 2 || !/^[+\d][\d\s()-]{7,}$/.test(phone)) return sendError(response, 400, 'Please check your name and phone number.');
  if (fulfillment === 'delivery' && address.length < 8) return sendError(response, 400, 'A complete delivery address is required.');
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) return sendError(response, 400, 'Your order must contain at least one menu item.');
  const menu = db.get('menu-items').value() || [];
  const items = [];
  for (const line of body.items) {
    const item = menu.find((entry) => String(entry.id) === String(line.menuItem));
    if (!item || !item.available) return sendError(response, 400, 'An item in your order is no longer available.');
    const quantity = Math.max(1, Math.min(20, Number(line.quantity) || 1));
    items.push({ menuItem: item.id, id: item.id, name: item.name, price: Number(item.price), quantity });
  }
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = fulfillment === 'delivery' ? 7 : 0;
  const order = {
    id: crypto.randomUUID(),
    orderNumber: `EMB-${Date.now().toString(36).toUpperCase()}-${crypto.randomInt(100, 1000)}`,
    customerName, phone, fulfillment, address, notes, items,
    subtotal, deliveryFee, total: subtotal + deliveryFee,
    status: 'pending', createdAt: new Date().toISOString(),
  };
  db.get('orders').push(order).write();
  response.status(201).json(order);
});

app.get('/api/order-tracking', (request, response) => {
  const orderNumber = String(request.query.orderNumber || '').trim();
  const phone = String(request.query.phone || '').trim();
  if (!orderNumber || !phone) return sendError(response, 400, 'Order number and phone are required.');
  const order = db.get('orders').find({ orderNumber, phone }).value();
  if (!order) return sendError(response, 404, 'We could not find an order with those details.');
  response.json(order);
});

app.get('/api/employee-orders', authenticated, (_request, response) => {
  const orders = db.get('orders').value() || [];
  response.json(orders.slice().sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 100));
});

app.patch('/api/employee-orders/:id', authenticated, (request, response) => {
  const { status } = request.body || {};
  if (!allowedStatuses.has(status)) return sendError(response, 400, 'Invalid order status.');
  const order = db.get('orders').find({ id: request.params.id }).value();
  if (!order) return sendError(response, 404, 'Order not found.');
  db.get('orders').find({ id: request.params.id }).assign({ status }).write();
  response.json(db.get('orders').find({ id: request.params.id }).value());
});

app.put('/api/employee-orders/:id', authenticated, (request, response) => {
  const order = db.get('orders').find({ id: request.params.id }).value();
  if (!order) return sendError(response, 404, 'Order not found.');
  const body = request.body || {};
  const customerName = String(body.customerName || '').trim().slice(0, 100);
  const phone = String(body.phone || '').trim().slice(0, 30);
  const fulfillment = body.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const address = fulfillment === 'delivery' ? String(body.address || '').trim().slice(0, 300) : '';
  if (customerName.length < 2 || !/^[+\d][\d\s()-]{7,}$/.test(phone)) return sendError(response, 400, 'Please check the customer name and phone number.');
  if (fulfillment === 'delivery' && address.length < 8) return sendError(response, 400, 'A complete delivery address is required.');
  const updated = { ...order, customerName, phone, fulfillment, address, notes: String(body.notes || '').slice(0, 500) };
  db.get('orders').find({ id: request.params.id }).assign(updated).write();
  response.json(updated);
});

app.delete('/api/employee-orders/:id', authenticated, (request, response) => {
  const order = db.get('orders').find({ id: request.params.id }).value();
  if (!order) return sendError(response, 404, 'Order not found.');
  db.get('orders').remove({ id: request.params.id }).write();
  response.json({ success: true });
});

const pages = new Map([
  ['/', 'index.html'], ['/menu', 'menu.html'], ['/cart', 'cart.html'],
  ['/checkout', 'checkout.html'], ['/confirmation', 'confirmation.html'],
  ['/track-order', 'track-order.html'], ['/dashboard', 'dashboard.html'],
]);
app.get('*', (request, response, next) => {
  if (request.path.startsWith('/api/')) return next();
  const file = pages.get(request.path);
  if (file) return response.sendFile(path.join(staticRoot, file));
  return next();
});

app.use('/api', (_request, response) => sendError(response, 404, 'API endpoint not found.'));
app.listen(port, '0.0.0.0', () => console.log(`Ember static site and JSON Server API listening on ${port}`));
