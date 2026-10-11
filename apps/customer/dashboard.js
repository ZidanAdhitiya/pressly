(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  const api = async (path, options = {}) => { const response = await fetch(path, options); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `Request gagal (${response.status})`); return body; };
  const toast = (message) => { const node = $('#toast'); node.textContent = message; node.className = 'toast-visible'; setTimeout(() => { node.className = ''; }, 3500); };
  const formatMoney = (value) => `Rp ${Number(value || 0).toLocaleString('id-ID')}`;
  const formatDate = (value) => value ? new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z')).toLocaleString('id-ID') : '-';
  let selectedOrder = null;
  let activeTeam = 'SETTING';
  const teamStatuses = {SETTING: ['DRAFT_MANUAL', 'MENUNGGU_VALIDASI_SETTING', 'SIAP_AUTO_LAYOUT', 'LAYOUT_TERSEDIA', 'DITOLAK_SETTING', 'PERLU_PERBAIKAN_SETTING'], KASIR: ['MENUNGGU_VALIDASI_KASIR', 'DITERIMA_KASIR']};
  async function loadOrders() {
    const params = new URLSearchParams();
    if ($('#statusFilter').value) params.set('workflow_status', $('#statusFilter').value);
    if ($('#sourceFilter').value) params.set('source', $('#sourceFilter').value);
    let orders = await api(`/api/dashboard/orders?${params}`);
    if (!$('#statusFilter').value) orders = orders.filter((order) => teamStatuses[activeTeam].includes(order.workflow_status));
    $('#orderCount').textContent = `${orders.length} order`;
    $('#ordersTable').innerHTML = orders.length ? `<table class="order-table"><thead><tr><th>Order</th><th>Customer</th><th>Sumber</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>${orders.map((order) => `<tr><td><strong>${escapeHtml(order.order_number)}</strong><small>${escapeHtml(formatDate(order.created_at))}</small></td><td><strong>${escapeHtml(order.customer_name || '-')}</strong><small>${escapeHtml(order.customer_phone || '')}</small></td><td><span class="source-badge">${escapeHtml(order.source)}</span></td><td>${formatMoney(order.grand_total)}</td><td><span class="workflow-badge">${escapeHtml(order.workflow_status)}</span>${order.rejection_reason ? `<small>${escapeHtml(order.rejection_reason)}</small>` : ''}</td><td><button class="table-button" data-order="${escapeHtml(order.order_number)}" type="button">Detail</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty-state">Tidak ada order pada filter ini.</div>';
    $('#ordersTable').querySelectorAll('[data-order]').forEach((button) => button.addEventListener('click', () => openDetail(button.dataset.order)));
  }

  async function loadNotifications(all = false) {
    const notifications = await api(`/api/dashboard/notifications?team=${activeTeam}&unread_only=${all ? 'false' : 'true'}`);
    $('#notificationList').innerHTML = notifications.length ? notifications.map((item) => `<article class="notice-item"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message)}</small><small>${escapeHtml(formatDate(item.created_at))}</small>${item.is_read ? '' : `<button class="table-button" data-read="${item.id}" type="button">Tandai dibaca</button>`}</article>`).join('') : '<div class="empty-state">Belum ada notifikasi baru.</div>';
    $('#notificationList').querySelectorAll('[data-read]').forEach((button) => button.addEventListener('click', async () => { await api(`/api/dashboard/notifications/${button.dataset.read}/read`, {method:'PUT'}); loadNotifications(); }));
  }

  async function openDetail(orderNumber) {
    const order = await api(`/api/dashboard/orders/${encodeURIComponent(orderNumber)}`); selectedOrder = order;
    const canDecide = ['DRAFT_MANUAL', 'MENUNGGU_VALIDASI_SETTING', 'MENUNGGU_DOUBLE_VERIFIKASI'].includes(order.workflow_status);
    const canLayout = ['SIAP_AUTO_LAYOUT', 'PERLU_PERBAIKAN_SETTING'].includes(order.workflow_status);
    const canTransfer = order.workflow_status === 'LAYOUT_TERSEDIA';
    const canCashierDecide = order.workflow_status === 'MENUNGGU_VALIDASI_KASIR';
    const layoutLink = order.layout_token ? `<p><a class="secondary" href="/api/dashboard/orders/${encodeURIComponent(order.order_number)}/layout">Download layout final</a></p>` : '';
    $('#detailContent').innerHTML = `<p class="eyebrow">ORDER DETAIL</p><h2>${escapeHtml(order.order_number)}</h2><div class="detail-meta"><div><small>Customer</small><b>${escapeHtml(order.customer_name || '-')}</b></div><div><small>Sumber</small><b>${escapeHtml(order.source || '-')}</b></div><div><small>Status workflow</small><b>${escapeHtml(order.workflow_status || '-')}</b></div><div><small>Total</small><b>${formatMoney(order.grand_total)}</b></div></div><ul class="detail-items">${(order.items || []).map((item) => `<li>${escapeHtml(item.product_name)} · ${escapeHtml(item.size_label)} · ${item.quantity} × ${formatMoney(item.unit_price)}${item.design_file ? ` · file: ${escapeHtml(item.design_file)}` : ''}</li>`).join('')}</ul>${layoutLink}${order.setting_note ? `<p><b>Catatan Setting:</b> ${escapeHtml(order.setting_note)}</p>` : ''}${canDecide ? '<div class="detail-actions"><input id="actorName" placeholder="Nama validator pertama"><input id="verifierName" placeholder="Nama verifier kedua"><input id="decisionNote" placeholder="Catatan / alasan penolakan"><button class="primary" id="acceptOrder" type="button">Terima + double verify</button><button class="table-button danger-button" id="rejectOrder" type="button">Tolak + double verify</button></div>' : ''}${canLayout ? '<div class="detail-actions"><button class="primary" id="layoutOrder" type="button">Buat Auto Layout</button></div>' : ''}${canTransfer ? '<div class="detail-actions"><input id="transferActor" placeholder="Nama Team Setting"><input id="transferNote" placeholder="Catatan transfer"><button class="primary" id="transferOrder" type="button">Transfer ke Kasir</button></div>' : ''}${canCashierDecide ? '<div class="detail-actions"><input id="cashierActor" placeholder="Nama Kasir"><input id="cashierNote" placeholder="Catatan / alasan penolakan"><button class="primary" id="cashierAccept" type="button">Terima order</button><button class="table-button danger-button" id="cashierReject" type="button">Tolak order</button></div>' : ''}<div id="detailMessage" class="manual-message"></div>`;
    $('#detailModal').hidden = false;
    $('#acceptOrder')?.addEventListener('click', () => decide('accept'));
    $('#rejectOrder')?.addEventListener('click', () => decide('reject'));
    $('#layoutOrder')?.addEventListener('click', () => { $('#layoutModal').hidden = false; });
    $('#transferOrder')?.addEventListener('click', () => transferOrder());
    $('#cashierAccept')?.addEventListener('click', () => cashierDecision('accept'));
    $('#cashierReject')?.addEventListener('click', () => cashierDecision('reject'));
  }

  async function decide(action) {
    const payload = {action, actor_name: $('#actorName').value.trim(), verifier_name: $('#verifierName').value.trim(), note: $('#decisionNote').value.trim()};
    try { await api(`/api/dashboard/orders/${encodeURIComponent(selectedOrder.order_number)}/setting-decision`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); $('#detailModal').hidden = true; toast('Keputusan tersimpan dengan double verification.'); await Promise.all([loadOrders(), loadNotifications()]); } catch (error) { $('#detailMessage').textContent = error.message; }
  }

  async function transferOrder() {
    try { await api(`/api/dashboard/orders/${encodeURIComponent(selectedOrder.order_number)}/transfer-cashier`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({actor_name:$('#transferActor').value.trim(), note:$('#transferNote').value.trim()})}); $('#detailModal').hidden = true; toast('Order ditransfer ke Kasir.'); await Promise.all([loadOrders(), loadNotifications()]); } catch (error) { $('#detailMessage').textContent = error.message; }
  }

  async function cashierDecision(action) {
    try { await api(`/api/dashboard/orders/${encodeURIComponent(selectedOrder.order_number)}/cashier-decision`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action, actor_name:$('#cashierActor').value.trim(), note:$('#cashierNote').value.trim()})}); $('#detailModal').hidden = true; toast('Keputusan Kasir tersimpan.'); await Promise.all([loadOrders(), loadNotifications()]); } catch (error) { $('#detailMessage').textContent = error.message; }
  }

  $('#manualButton').addEventListener('click', () => { $('#manualModal').hidden = false; $('#manualMessage').textContent = ''; });
  document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', () => { button.closest('.modal').hidden = true; }));
  $('#refreshButton').addEventListener('click', () => Promise.all([loadOrders(), loadNotifications()]));
  $('#allNotifications').addEventListener('click', () => loadNotifications(true));
  $('#teamFilter').addEventListener('change', () => { activeTeam = $('#teamFilter').value; $('#statusFilter').value = ''; loadOrders(); loadNotifications(); });
  $('#statusFilter').addEventListener('change', loadOrders); $('#sourceFilter').addEventListener('change', loadOrders); $('#clearFilter').addEventListener('click', () => { $('#statusFilter').value = ''; $('#sourceFilter').value = ''; loadOrders(); });
  $('#manualForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const payload = {source:form.get('source'), actor_name:form.get('actor_name'), customer_name:form.get('customer_name'), customer_phone:form.get('customer_phone'), deadline_at:form.get('deadline_at') || null, delivery_method:form.get('delivery_method'), address:form.get('address'), note:form.get('note'), items:[{product_name:form.get('product_name'), size_label:form.get('size_label'), quantity:Number(form.get('quantity')), unit_price:Number(form.get('unit_price')), material:form.get('material'), finishing:form.get('finishing'), design_file:form.get('design_file')}]}; try { await api('/api/dashboard/orders/manual', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); $('#manualModal').hidden = true; event.currentTarget.reset(); toast('Order manual masuk ke antrean Setting.'); await Promise.all([loadOrders(), loadNotifications()]); } catch (error) { $('#manualMessage').textContent = error.message; } });
  $('#layoutForm').addEventListener('submit', async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); form.append('order_id', selectedOrder.order_number); form.append('product', selectedOrder.items?.[0]?.product_name || ''); form.append('size', selectedOrder.items?.[0]?.size_label || ''); form.append('customer', selectedOrder.customer_name || 'customer'); form.append('output_format', 'PDF'); try { await api('/api/layouts', {method:'POST', body:form}); $('#layoutModal').hidden = true; $('#detailModal').hidden = true; event.currentTarget.reset(); toast('Auto Layout tersimpan.'); await Promise.all([loadOrders(), loadNotifications()]); } catch (error) { $('#layoutMessage').textContent = error.message; } });
  Promise.all([loadOrders(), loadNotifications()]).catch((error) => { $('#ordersTable').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`; });
})();
