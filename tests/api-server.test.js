// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverFile = fileURLToPath(new URL('../server.js', import.meta.url));
let workspace;
let dataFile;
let baseUrl;
let child;
let output = '';

async function reservePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const { port } = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function startServer() {
  const port = await reservePort();
  baseUrl = `http://127.0.0.1:${port}`;
  output = '';
  child = spawn(process.execPath, [serverFile], {
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), DB_FILE: dataFile },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`API server exited early: ${output}`);
    try {
      const response = await fetch(`${baseUrl}/api/menu-items`);
      if (response.ok) return;
    } catch { /* Wait for the child server to bind its port. */ }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`API server did not start: ${output}`);
}

async function stopServer() {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolve) => {
    child.once('exit', resolve);
    child.kill('SIGTERM');
  });
}

beforeAll(async () => {
  workspace = await mkdtemp(path.join(os.tmpdir(), 'ember-api-test-'));
  dataFile = path.join(workspace, 'db.json');
  await startServer();
});

afterAll(async () => {
  await stopServer();
  if (workspace) await rm(workspace, { recursive: true, force: true });
});

const json = (body) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('JSON Server API CRUD and persistence', () => {
  it('creates, reads, replaces, patches, and deletes an order', async () => {
    const menuResponse = await fetch(`${baseUrl}/api/menu-items`);
    expect(menuResponse.status).toBe(200);
    const [menuItem] = await menuResponse.json();

    const createResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST', ...json({
        customerName: 'Test Customer',
        phone: '+1 (503) 555-0199',
        fulfillment: 'pickup',
        items: [{ menuItem: menuItem.id, quantity: 2 }],
      }),
    });
    expect(createResponse.status).toBe(201);
    const order = await createResponse.json();
    expect(order.items[0].quantity).toBe(2);

    const seedAfterPost = JSON.parse(await readFile(dataFile, 'utf8'));
    expect(seedAfterPost.orders.some((entry) => entry.id === order.id)).toBe(true);

    const trackedResponse = await fetch(`${baseUrl}/api/order-tracking?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.phone)}`);
    expect(trackedResponse.status).toBe(200);
    expect((await trackedResponse.json()).id).toBe(order.id);

    const loginResponse = await fetch(`${baseUrl}/api/staff/login`, {
      method: 'POST', ...json({ username: 'string', password: 'string' }),
    });
    expect(loginResponse.status).toBe(200);
    const { token } = await loginResponse.json();
    const auth = { Authorization: `Bearer ${token}` };

    const replaceResponse = await fetch(`${baseUrl}/api/employee-orders/${order.id}`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ ...order, fulfillment: 'delivery', address: '428 Alder Street' }),
    });
    expect(replaceResponse.status).toBe(200);
    expect((await replaceResponse.json()).fulfillment).toBe('delivery');

    const patchResponse = await fetch(`${baseUrl}/api/employee-orders/${order.id}`, {
      method: 'PATCH', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }),
    });
    expect(patchResponse.status).toBe(200);
    expect((await patchResponse.json()).status).toBe('ready');

    const listResponse = await fetch(`${baseUrl}/api/employee-orders`, { headers: auth });
    expect((await listResponse.json()).some((entry) => entry.id === order.id)).toBe(true);

    const deleteResponse = await fetch(`${baseUrl}/api/employee-orders/${order.id}`, { method: 'DELETE', headers: auth });
    expect(deleteResponse.status).toBe(200);
    const deletedTracking = await fetch(`${baseUrl}/api/order-tracking?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.phone)}`);
    expect(deletedTracking.status).toBe(404);
  });

  it('rejects invalid order data with a useful response', async () => {
    const response = await fetch(`${baseUrl}/api/orders`, { method: 'POST', ...json({}) });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/name and phone/i);
  });
});
