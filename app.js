import { addCartItem, cartCount, cartSubtotal, clearCart, readCart, saveCart, updateCartItem } from './cart.js';
import { createOrder, deleteOrder, getEmployeeOrders, getMenu, patchOrder, replaceOrder, staffLogin, staffLogout, trackOrder } from './api.js';
import { escapeHTML, label, money } from './format.js';
import { validateCheckout } from './validation.js';

const page = document.body.dataset.page;
let cart = readCart();
const statuses = ['pending', 'preparing', 'ready', 'out-for-delivery', 'delivered', 'cancelled'];
const trackSteps = statuses.slice(0, 5);
const itemImage = (item) => typeof item.image === 'string' ? item.image : item.image?.url || '';
const imageMarkup = (item, extra = '') => itemImage(item) ? `<img class="${extra}" src="${escapeHTML(itemImage(item))}" alt="${escapeHTML(typeof item.image === 'object' ? item.image.alt || item.name : item.name)}" loading="lazy">` : `<div class="${extra}" role="img" aria-label="${escapeHTML(item.name)}"></div>`;
const syncCart = () => { saveCart(cart); document.querySelectorAll('[data-cart-count]').forEach((node) => { node.textContent = cartCount(cart); }); };
const setMessage = (node, message, error = false) => { if (!node) return; node.textContent = message; node.classList.toggle('is-error', error); };
const apiError = (error) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function renderFeatured(items) {
  const root = document.querySelector('[data-featured-menu]');
  if (!root) return;
  const featured = items.filter((item) => item.featured).slice(0, 3);
  root.innerHTML = featured.length ? featured.map((item) => `<article class="signature-card"><div class="image-wrap">${imageMarkup(item)}</div><div class="signature-title-row"><h3>${escapeHTML(item.name)}</h3><span>${money(item.price)}</span></div><p>${escapeHTML(item.description)}</p></article>`).join('') : '<p class="loading-note">Our evening selection is being prepared.</p>';
}

function renderMenu(items) {
  const root = document.querySelector('[data-menu-items]');
  const status = document.querySelector('[data-menu-status]');
  if (!root) return;
  const category = document.querySelector('.category-chip.is-active')?.dataset.category || 'all';
  const query = document.querySelector('#menu-search')?.value.trim().toLowerCase() || '';
  const filtered = items.filter((item) => (category === 'all' || item.category === category) && `${item.name} ${item.description}`.toLowerCase().includes(query));
  root.innerHTML = filtered.map((item) => `<article class="menu-card"><div class="menu-image-wrap">${imageMarkup(item, 'menu-image')}${item.available ? '' : '<div class="unavailable-overlay">Unavailable tonight</div>'}</div><div class="menu-meta"><div><p class="menu-category">${label(item.category)}</p><h2>${escapeHTML(item.name)}</h2></div><span class="menu-price">${money(item.price)}</span></div><p class="menu-description">${escapeHTML(item.description)}</p><button class="add-button" data-add-item="${escapeHTML(item.id)}" ${item.available ? '' : 'disabled'}>${item.available ? 'Add to order' : 'Unavailable'} <span aria-hidden="true">＋</span></button></article>`).join('');
  setMessage(status, filtered.length ? '' : 'No dishes match your search.');
  root._items = items;
}

async function initMenu() {
  const status = document.querySelector('[data-menu-status]');
  try {
    const items = await getMenu();
    renderMenu(items);
    renderFeatured(items);
    document.querySelectorAll('[data-category]').forEach((button) => button.addEventListener('click', () => {
      document.querySelector('.category-chip.is-active')?.classList.remove('is-active');
      button.classList.add('is-active'); renderMenu(items);
    }));
    document.querySelector('#menu-search')?.addEventListener('input', () => renderMenu(items));
    document.querySelector('[data-menu-items]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-item]');
      if (!button) return;
      const item = items.find((entry) => String(entry.id) === button.dataset.addItem);
      if (!item) return;
      cart = addCartItem(cart, item); syncCart(); button.innerHTML = 'Added to your order <span aria-hidden="true">✓</span>';
      window.setTimeout(() => { if (button.isConnected) button.innerHTML = 'Add to order <span aria-hidden="true">＋</span>'; }, 1400);
    });
  } catch (error) {
    setMessage(status, apiError(error), true);
    const featured = document.querySelector('[data-featured-menu]');
    if (featured) featured.innerHTML = '<p class="loading-note">The menu could not be loaded. Please try again shortly.</p>';
  }
}

function renderCart() {
  const root = document.querySelector('[data-cart-view]');
  if (!root) return;
  if (!cart.length) {
    root.innerHTML = '<div class="empty-state"><h2>Your cart is empty.</h2><p>Choose something wonderful from tonight’s menu.</p><a class="button button-dark" href="/menu">View the menu <span aria-hidden="true">→</span></a></div>';
    return;
  }
  root.innerHTML = `<div class="cart-layout"><div class="cart-items">${cart.map((item) => `<article class="cart-row">${imageMarkup(item)}<div><h2>${escapeHTML(item.name)}</h2><p>${money(item.price)} each</p><div class="quantity-control"><button type="button" data-quantity="-1" data-item-id="${escapeHTML(item.id)}" aria-label="Decrease ${escapeHTML(item.name)}">−</button><span>${item.quantity}</span><button type="button" data-quantity="1" data-item-id="${escapeHTML(item.id)}" aria-label="Increase ${escapeHTML(item.name)}">＋</button></div></div><div class="cart-row-total"><strong>${money(item.price * item.quantity)}</strong><button class="remove-button" type="button" data-remove-item="${escapeHTML(item.id)}">Remove</button></div></article>`).join('')}</div><aside class="summary-card"><h2>Order summary</h2><div class="summary-line"><span>Subtotal</span><strong>${money(cartSubtotal(cart))}</strong></div><p class="summary-note">Delivery and taxes are calculated at checkout. Pickup is always complimentary.</p><a class="button button-primary" href="/checkout">Proceed to checkout <span aria-hidden="true">→</span></a><a class="continue-link" href="/menu">Continue ordering</a></aside></div>`;
  root.onclick = (event) => {
    const quantity = event.target.closest('[data-quantity]');
    const remove = event.target.closest('[data-remove-item]');
    if (quantity) cart = updateCartItem(cart, quantity.dataset.itemId, (cart.find((line) => String(line.id) === quantity.dataset.itemId)?.quantity || 0) + Number(quantity.dataset.quantity));
    if (remove) cart = cart.filter((line) => String(line.id) !== remove.dataset.removeItem);
    if (quantity || remove) { syncCart(); renderCart(); }
  };
}

let fulfillment = 'delivery';
function renderCheckout() {
  const root = document.querySelector('[data-checkout-view]');
  if (!root) return;
  if (!cart.length) { root.innerHTML = '<div class="empty-state"><h2>Nothing to check out yet.</h2><a class="button button-dark" href="/menu">Explore the menu</a></div>'; return; }
  const fee = fulfillment === 'delivery' ? 7 : 0;
  root.innerHTML = `<form class="checkout-layout" data-checkout-form novalidate><div class="checkout-form"><section class="form-section"><h2>1 · Fulfillment</h2><div class="fulfillment-options"><button class="fulfillment-option ${fulfillment === 'delivery' ? 'is-selected' : ''}" type="button" data-fulfillment="delivery"><strong>Delivery</strong><span>35–50 minutes · $7</span></button><button class="fulfillment-option ${fulfillment === 'pickup' ? 'is-selected' : ''}" type="button" data-fulfillment="pickup"><strong>Pickup</strong><span>Ready in 25–35 minutes</span></button></div></section><section class="form-section"><h2>2 · Your details</h2><div class="field-grid"><label class="field-label">Full name<input class="field-input" name="name" required autocomplete="name" placeholder="Your name"></label><label class="field-label">Phone number<input class="field-input" name="phone" required autocomplete="tel" placeholder="+1 (503) 555-0123"></label>${fulfillment === 'delivery' ? '<label class="field-label field-label--full">Delivery address<textarea class="field-input" name="address" required rows="3" autocomplete="street-address" placeholder="Street, apartment, city, postal code"></textarea></label>' : ''}<label class="field-label field-label--full">Kitchen notes <span>(optional)</span><textarea class="field-input" name="notes" rows="3" placeholder="Allergies or delivery instructions"></textarea></label></div></section></div><aside class="summary-card"><h2>Your order</h2><div class="checkout-summary-items">${cart.map((item) => `<div class="checkout-summary-item"><span><b>${item.quantity}×</b>${escapeHTML(item.name)}</span><span>${money(item.price * item.quantity)}</span></div>`).join('')}</div><div class="summary-line"><span>Subtotal</span><span>${money(cartSubtotal(cart))}</span></div><div class="summary-line"><span>Delivery</span><span>${fee ? money(fee) : 'Complimentary'}</span></div><div class="checkout-total"><span>Total</span><strong>${money(cartSubtotal(cart) + fee)}</strong></div><p class="error-box" data-checkout-error hidden></p><button class="button button-primary" data-place-order type="submit">Place order <span aria-hidden="true">→</span></button><p class="summary-note">Payment is collected on delivery or pickup.</p></aside></form>`;
  root.querySelectorAll('[data-fulfillment]').forEach((button) => button.addEventListener('click', () => { fulfillment = button.dataset.fulfillment; renderCheckout(); }));
  root.querySelector('[data-checkout-form]').addEventListener('submit', submitOrder);
}

async function submitOrder(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const errorNode = form.querySelector('[data-checkout-error]');
  const validationError = validateCheckout({ name: data.get('name'), phone: data.get('phone'), address: data.get('address'), fulfillment });
  if (!cart.length || validationError) { errorNode.hidden = false; errorNode.textContent = validationError || 'Your cart is empty.'; return; }
  const submitButton = form.querySelector('[data-place-order]'); submitButton.disabled = true; submitButton.textContent = 'Placing order…'; errorNode.hidden = true;
  try {
    const result = await createOrder({ customerName: String(data.get('name')).trim(), phone: String(data.get('phone')).trim(), fulfillment, address: fulfillment === 'delivery' ? String(data.get('address')).trim() : '', notes: String(data.get('notes') || '').trim(), items: cart.map((item) => ({ menuItem: item.id, quantity: item.quantity })) });
    sessionStorage.setItem('ember-last-order', JSON.stringify(result)); clearCart(); cart = []; window.location.assign('/confirmation');
  } catch (error) { errorNode.hidden = false; errorNode.textContent = apiError(error); submitButton.disabled = false; submitButton.innerHTML = 'Place order <span aria-hidden="true">→</span>'; }
}

function renderConfirmation() {
  const root = document.querySelector('[data-confirmation-view]');
  if (!root) return;
  let order; try { order = JSON.parse(sessionStorage.getItem('ember-last-order') || 'null'); } catch { order = null; }
  if (!order) { root.className = 'page-shell page-content'; root.innerHTML = '<div class="empty-state"><h1>No recent order found.</h1><a class="button button-dark" href="/menu">View the menu</a></div>'; return; }
  root.className = 'confirmation-main';
  root.innerHTML = `<div class="page-shell"><p class="eyebrow eyebrow--light">Order confirmed</p><h1>The fire is <em>lit.</em></h1><p>Thank you, ${escapeHTML(order.customerName)}. Your order is with our kitchen and we’ll keep its progress updated.</p><div class="confirmation-grid"><article><h2>Order number</h2><strong>${escapeHTML(order.orderNumber)}</strong><p>${order.fulfillment === 'delivery' ? `Delivery to ${escapeHTML(order.address)}` : 'Pickup at 428 Alder Street'}</p></article><article><h2>Order total</h2><strong>${money(order.total)}</strong><p>${(order.items || []).map((item) => `${Number(item.quantity)}× ${escapeHTML(item.name)}`).join('<br>')}</p></article></div><a class="button button-primary" href="/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.phone || '')}">View order status <span aria-hidden="true">→</span></a></div>`;
}

async function showTracking(number, phone) {
  const message = document.querySelector('[data-tracking-message]');
  const root = document.querySelector('[data-tracking-result]');
  root.innerHTML = ''; setMessage(message, 'Checking your order…');
  try {
    const order = await trackOrder(number, phone);
    setMessage(message, '');
    const active = trackSteps.indexOf(order.status);
    root.innerHTML = `<section class="tracking-result"><div class="tracking-card"><p class="menu-category">Order ${escapeHTML(order.orderNumber)}</p><h2>${label(order.status)}</h2><p class="page-intro">${order.fulfillment === 'delivery' ? 'Estimated 35–50 min' : 'Pickup in 25–35 min'}</p><div class="tracking-steps">${trackSteps.map((step, index) => `<div class="tracking-step ${index <= active ? 'is-complete' : ''} ${index === active ? 'is-current' : ''}"><div class="tracking-dot"></div><p class="tracking-step-label">${label(step)}</p></div>`).join('')}</div><p class="tracking-address"><strong>${order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup'}:</strong> ${order.fulfillment === 'delivery' ? escapeHTML(order.address) : '428 Alder Street, Portland'}</p></div><aside class="summary-card"><h2>Order summary</h2><div class="checkout-summary-items">${(order.items || []).map((item) => `<div class="checkout-summary-item"><span>${item.quantity}× ${escapeHTML(item.name)}</span><span>${money(item.price * item.quantity)}</span></div>`).join('')}</div><div class="checkout-total"><span>Total</span><strong>${money(order.total)}</strong></div></aside></section>`;
  } catch (error) { setMessage(message, apiError(error), true); }
}

function initTracking() {
  const form = document.querySelector('[data-tracking-form]');
  if (!form) return;
  const params = new URLSearchParams(location.search);
  form.elements.orderNumber.value = params.get('orderNumber') || '';
  form.elements.phone.value = params.get('phone') || '';
  form.addEventListener('submit', (event) => { event.preventDefault(); showTracking(form.elements.orderNumber.value.trim(), form.elements.phone.value.trim()); });
  if (form.elements.orderNumber.value && form.elements.phone.value) showTracking(form.elements.orderNumber.value, form.elements.phone.value);
}

function renderStaffLogin(root, message = '') {
  root.innerHTML = `<div class="page-shell page-content"><p class="eyebrow">Employee access</p><h1 class="editorial-title">Staff sign-in required.</h1><p class="page-intro">Order details are private. Sign in with your restaurant staff account to access the service board.</p><form class="staff-login" data-staff-login><h2>Sign in</h2><label>Username<input name="username" required autocomplete="username"></label><label>Password<input name="password" type="password" required autocomplete="current-password"></label><p class="error-box" data-login-error ${message ? '' : 'hidden'}>${escapeHTML(message)}</p><button class="button button-dark" type="submit">Sign in</button></form></div>`;
  root.querySelector('[data-staff-login]').addEventListener('submit', async (event) => {
    event.preventDefault(); const form = event.currentTarget; const error = form.querySelector('[data-login-error]'); const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Signing in…';
    try { await staffLogin(form.elements.username.value, form.elements.password.value); await renderDashboard(); }
    catch (failure) { error.hidden = false; error.textContent = apiError(failure); button.disabled = false; button.textContent = 'Sign in'; }
  });
}

async function renderDashboard(message = '') {
  const root = document.querySelector('[data-dashboard-view]');
  if (!root) return;
  root.innerHTML = '<div class="page-shell page-content">Loading orders…</div>';
  let orders;
  try { orders = await getEmployeeOrders(); }
  catch { if (localStorage.getItem('ember-staff-token')) staffLogout(); renderStaffLogin(root); return; }
  const revenue = orders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total), 0);
  root.innerHTML = `<div class="page-shell"><div class="dashboard-heading"><div><p class="eyebrow">Restaurant operations</p><h1>Service <em>board.</em></h1></div><div><button class="button button-dark" data-refresh-orders>Refresh orders</button> <button class="button button-light" data-staff-logout>Sign out</button></div></div><div class="dashboard-stats"><div class="stat-card"><span>Open orders</span><strong>${orders.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length}</strong></div><div class="stat-card"><span>Orders today</span><strong>${orders.length}</strong></div><div class="stat-card"><span>Order total</span><strong>${money(revenue)}</strong></div></div>${message ? `<p class="dashboard-message" role="status">${escapeHTML(message)}</p>` : ''}<div class="table-wrap"><table class="orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Details</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>${orders.map((order) => `<tr><td><strong>${escapeHTML(order.orderNumber)}</strong><span class="table-subtext">${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td><td>${escapeHTML(order.customerName)}<span class="table-subtext">${escapeHTML(order.phone)}</span></td><td>${label(order.fulfillment)}<span class="table-subtext">${(order.items || []).map((item) => `${item.quantity}× ${escapeHTML(item.name)}`).join(', ')}</span></td><td>${money(order.total)}</td><td><label class="visually-hidden" for="status-${escapeHTML(order.id)}">Status for ${escapeHTML(order.orderNumber)}</label><select id="status-${escapeHTML(order.id)}" data-order-status="${escapeHTML(order.id)}">${statuses.map((status) => `<option value="${status}" ${status === order.status ? 'selected' : ''}>${label(status)}</option>`).join('')}</select></td><td><button class="table-action" data-mark-pickup="${escapeHTML(order.id)}">Set pickup</button> <button class="table-action table-action--delete" data-delete-order="${escapeHTML(order.id)}" aria-label="Delete ${escapeHTML(order.orderNumber)}">Delete</button></td></tr>`).join('')}</tbody></table>${orders.length ? '' : '<p class="empty-state">No orders yet. The service board is ready.</p>'}</div></div>`;
  root.querySelector('[data-refresh-orders]').addEventListener('click', () => renderDashboard('Orders refreshed.'));
  root.querySelector('[data-staff-logout]').addEventListener('click', () => { staffLogout(); renderStaffLogin(root); });
  root.querySelectorAll('[data-order-status]').forEach((select) => select.addEventListener('change', async () => {
    try { await patchOrder(select.dataset.orderStatus, { status: select.value }); await renderDashboard(`${select.closest('tr').querySelector('td strong').textContent} updated.`); }
    catch (error) { await renderDashboard(apiError(error)); }
  }));
  root.querySelectorAll('[data-mark-pickup]').forEach((button) => button.addEventListener('click', async () => {
    const order = orders.find((entry) => String(entry.id) === button.dataset.markPickup);
    try { await replaceOrder(order.id, { ...order, fulfillment: 'pickup', address: '' }); await renderDashboard(`${order.orderNumber} changed to pickup.`); }
    catch (error) { await renderDashboard(apiError(error)); }
  }));
  root.querySelectorAll('[data-delete-order]').forEach((button) => button.addEventListener('click', async () => {
    const order = orders.find((entry) => String(entry.id) === button.dataset.deleteOrder);
    if (!window.confirm(`Delete ${order.orderNumber}? This cannot be undone.`)) return;
    try { await deleteOrder(order.id); await renderDashboard(`${order.orderNumber} deleted.`); }
    catch (error) { await renderDashboard(apiError(error)); }
  }));
}

syncCart();
if (page === 'home' || page === 'menu') initMenu();
if (page === 'cart') renderCart();
if (page === 'checkout') renderCheckout();
if (page === 'confirmation') renderConfirmation();
if (page === 'tracking') initTracking();
if (page === 'dashboard') renderDashboard();
