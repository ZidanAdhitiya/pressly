(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const statusLabel = {unpaid:'Belum bayar',partial:'DP / sebagian',paid:'Lunas',void:'Dibatalkan'};
  const statusFilter = `<option value="">Semua status</option><option value="unpaid">Belum bayar</option><option value="partial">DP / sebagian</option><option value="paid">Lunas</option><option value="void">Dibatalkan</option>`;
  const content = $('#cashierPageContent');
  if (!content) return;
  let currentPage = 'sale';
  let searchTimer;
  let webUnreadCount = null;

  function showWebOrderPopup(count, order = null) {
    document.querySelector('#webOrderPopup')?.remove();
    const popup = document.createElement('section');
    popup.id = 'webOrderPopup';
    popup.className = 'web-order-popup';
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-live', 'assertive');
    popup.innerHTML = `<div class="web-order-popup-icon" aria-hidden="true">!</div><div class="web-order-popup-copy"><b>Order web baru masuk</b><span>${order ? `${esc(order.order_number)} � ${esc(order.customer_name || 'Customer')} � ${window.cashierMoney(order.grand_total)}` : `${count} order menunggu dibuka`}</span></div><button class="web-order-popup-open" type="button">Lihat order</button><button class="web-order-popup-close" type="button" aria-label="Tutup notifikasi">�</button>`;
    popup.querySelector('.web-order-popup-open').addEventListener('click', () => { popup.remove(); $('.cashier-nav[data-page="web-orders"]')?.click(); });
    popup.querySelector('.web-order-popup-close').addEventListener('click', () => popup.remove());
    document.body.appendChild(popup);
  }

  async function refreshWebOrderBadge(showNotice = false) {
    const badge = $('#webOrderBadge');
    if (!badge || !window.cashierInitialized) return;
    try {
      const result = await window.cashierApi('/api/cashier/web-notifications');
      const count = Number(result.unread || 0);
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count < 1;
      const isInitialUnread = webUnreadCount === null && count > 0;
      const hasNewUnread = webUnreadCount !== null && count > webUnreadCount;
      if (count > 0 && (isInitialUnread || (showNotice && hasNewUnread))) {
        const orders = await window.cashierApi('/api/cashier/web-orders').catch(() => []);
        showWebOrderPopup(count, orders[0] || null);
        if (currentPage === 'web-orders') loadWebOrders();
      }
      webUnreadCount = count;
    } catch { /* Kasir tetap dapat digunakan saat koneksi database terputus sementara. */ }
  }

  async function loadWebOrders() {
    const list = $('#cashierWebOrdersList');
    if (!list) return;
    list.innerHTML = '<div class="no-results">Memuat order web...</div>';
    try {
      const rows = await window.cashierApi('/api/cashier/web-orders');
      const query = ($('#cashierWebOrdersSearch')?.value || '').trim().toLocaleLowerCase('id-ID');
      const filtered = rows.filter((order) => !query || `${order.order_number} ${order.customer_name} ${order.customer_phone} ${order.shipping_courier || ''}`.toLocaleLowerCase('id-ID').includes(query));
      const paymentLabel = {pending_payment:'Menunggu pembayaran',paid:'Lunas',processing:'Diproses',ready:'Siap diambil',completed:'Selesai',cancelled:'Dibatalkan',draft:'Draft'};
      list.innerHTML = filtered.length ? filtered.map((order) => {
        const delivery = order.delivery_method === 'delivery' ? `Diantar · ${esc(order.shipping_courier === 'GOSEND' ? 'GoSend' : (order.shipping_courier || 'Kurir belum dipilih'))}` : 'Take Away (Ambil di Toko)';
        const map = order.latitude != null && order.longitude != null ? `https://www.google.com/maps?q=${encodeURIComponent(`${order.latitude},${order.longitude}`)}` : '';
        const items = (order.items || []).map((item) => `<li>${esc(item.product_name)} · ${esc(item.size_label)} · ${Number(item.quantity).toLocaleString('id-ID')} pcs${item.finishing ? ` · ${esc(item.finishing)}` : ''}</li>`).join('');
        const location = order.location_label || order.address || '';
        return `<article class="cashier-web-order"><header><div><b>${esc(order.order_number)}</b><small>${esc(window.cashierDateLabel(order.created_at))}</small></div><strong>${window.cashierMoney(order.grand_total)}</strong></header><div class="cashier-web-order-meta"><span>${esc(order.customer_name || 'Customer')}</span><span>${esc(order.customer_phone || 'Tanpa nomor WhatsApp')}</span><span>${delivery}</span><span class="cashier-status">${esc(paymentLabel[order.status] || order.status)}</span></div><ul>${items || '<li>Detail item tidak tersedia</li>'}</ul>${location ? `<p><b>Lokasi:</b> ${esc(location)}</p>` : ''}${order.address_detail ? `<p><b>Detail alamat:</b> ${esc(order.address_detail)}</p>` : ''}${map ? `<a href="${map}" target="_blank" rel="noopener">Buka titik lokasi di Google Maps ↗</a>` : ''}</article>`;
      }).join('') : `<div class="no-results">${query ? 'Order web tidak ditemukan.' : 'Belum ada order dari website.'}</div>`;
      $('#cashierWebOrdersCount').textContent = `${filtered.length} dari ${rows.length} order`;
    } catch (error) { list.innerHTML = `<div class="no-results">${esc(error.message)}</div>`; }
  }

  function showWebOrders() {
    currentPage = 'web-orders';
    setWorkspaceHeader('web-orders');
    content.innerHTML = `<div class="cashier-history-card"><div class="cashier-history-title-row"><h2 class="cashier-view-title">Order <em>web.</em></h2><span id="cashierWebOrdersCount" class="cashier-sales-count-badge">Memuat...</span></div><p class="cashier-meta-line">Pesanan yang sudah checkout di website customer. Pembayaran dapat berstatus menunggu hingga Midtrans mengonfirmasi.</p><div class="cashier-history-tools"><input id="cashierWebOrdersSearch" class="cashier-search" type="search" placeholder="Cari nomor order, customer, atau kurir"><button id="cashierWebOrdersRefresh" class="secondary-button" type="button">Perbarui</button></div><div id="cashierWebOrdersList"></div></div>`;
    $('#cashierWebOrdersSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadWebOrders, 250); });
    $('#cashierWebOrdersRefresh').addEventListener('click', loadWebOrders);
    window.cashierApi('/api/cashier/web-notifications/read', {method:'POST', body:'{}'}).then(() => refreshWebOrderBadge()).catch(() => {});
    loadWebOrders();
  }

  async function openSale(id) {
    try {
      const sale = await window.cashierApi(`/api/cashier/sales/${id}`);
      window.cashierRenderReceipt(sale);
      const actions = $('#receiptModal .cashier-detail-actions');
      actions.querySelectorAll('[data-sale-action]').forEach((node) => node.remove());
      if (sale.status !== 'paid' && sale.status !== 'void') {
        actions.insertAdjacentHTML('afterbegin', '<button class="cashier-inline-button" data-sale-action="payment" type="button">Catat pembayaran</button>');
      }
      if (sale.status === 'unpaid' && Number(sale.cashier_id) === Number(window.cashierCurrentUser?.id)) {
        actions.insertAdjacentHTML('afterbegin', '<button class="cashier-inline-button cashier-void" data-sale-action="void" type="button">Batalkan nota</button>');
      }
      actions.querySelector('[data-sale-action="payment"]')?.addEventListener('click', () => paymentDialog(sale));
      actions.querySelector('[data-sale-action="void"]')?.addEventListener('click', () => voidDialog(sale));
    } catch (error) { window.cashierToast(error.message); }
  }
  async function updatePayment(id) {
    try {
      const sale = await window.cashierApi(`/api/cashier/sales/${id}`);
      if (sale.status === 'paid') { window.cashierToast('Nota sudah lunas.'); return; }
      if (sale.status === 'void') { window.cashierToast('Nota dibatalkan dan tidak dapat diperbarui.'); return; }
      paymentDialog(sale, false);
    } catch (error) { window.cashierToast(error.message); }
  }
  function actionDialog(markup, onSubmit) {
    const modal = $('#cashierActionModal'); const form = $('#cashierActionForm'); const previouslyFocused = document.activeElement;
    $('#cashierActionContent').innerHTML = markup; $('#cashierActionError').textContent = ''; modal.hidden = false;
    const close = () => { modal.hidden = true; form.onsubmit = null; previouslyFocused?.focus?.(); };
    form.querySelectorAll('[data-close-action]').forEach((button) => { button.onclick = (event) => { event.preventDefault(); close(); }; });
    modal.onclick = (event) => { if (event.target === modal) close(); };
    form.querySelector('input,select,textarea')?.focus();
    form.onsubmit = async (event) => { event.preventDefault(); const button = form.querySelector('[type="submit"]'); button.disabled = true; $('#cashierActionError').textContent = ''; try { await onSubmit(new FormData(form)); close(); } catch (error) { $('#cashierActionError').textContent = error.message; } finally { button.disabled = false; } };
  }
  document.addEventListener('keydown', (event) => {
    const modal = $('#cashierActionModal');
    if (event.key === 'Escape' && modal && !modal.hidden) {
      modal.hidden = true;
      $('#cashierActionForm').onsubmit = null;
    }
    const stockModal = $('#cashierMaterialCheckModal');
    if (event.key === 'Escape' && stockModal && !stockModal.hidden) stockModal.hidden = true;
  });
  function paymentDialog(sale, showReceiptAfterSave = true) {
    const remaining = Math.max(0, Number(sale.total) - Number(sale.amount_paid));
    actionDialog(`<p class="eyebrow">PEMBAYARAN NOTA</p><h2>${esc(sale.invoice_number)}</h2><p>Sisa tagihan <b>${window.cashierMoney(remaining)}</b></p><label>Metode pembayaran<select name="method"><option value="cash">Tunai</option><option value="qris">QRIS</option><option value="transfer">Transfer</option><option value="edc">EDC</option></select></label><label>Jumlah diterima<input name="amount" type="number" min="1" step="1" value="${Math.ceil(remaining)}" required></label><button class="primary-button" type="submit">Simpan pembayaran</button>`, async (data) => {
      const updated = await window.cashierApi(`/api/cashier/sales/${sale.id}/payments`, {method:'POST',body:JSON.stringify({method:data.get('method'),amount:Number(data.get('amount'))})});
      if (showReceiptAfterSave) { $('#receiptModal').hidden = true; window.cashierRenderReceipt(updated); }
      else window.cashierToast('Pembayaran invoice berhasil diperbarui.');
      await loadSales(); await window.cashierRefreshStats();
    });
  }
  function voidDialog(sale) {
    actionDialog(`<p class="eyebrow">AUDIT / PEMBATALAN NOTA</p><h2>Batalkan ${esc(sale.invoice_number)}?</h2><p>Hanya nota belum dibayar yang dapat dibatalkan dari Kasir.</p><label>Alasan pembatalan<textarea name="reason" rows="3" minlength="3" maxlength="2000" required></textarea></label><button class="primary-button cashier-void" type="submit">Batalkan nota</button>`, async (data) => {
      const updated = await window.cashierApi(`/api/cashier/sales/${sale.id}/void`, {method:'POST',body:JSON.stringify({reason:data.get('reason')})});
      $('#receiptModal').hidden = true; window.cashierRenderReceipt(updated); await loadSales(); await window.cashierRefreshStats();
    });
  }
  async function loadSales() {
    const list = $('#cashierSalesList'); if (!list) return;
    const params = new URLSearchParams({q:$('#cashierSalesSearch').value,status:$('#cashierSalesStatus').value});
    list.innerHTML = '<div class="no-results">Memuat riwayat nota...</div>';
    try {
      const rows = await window.cashierApi(`/api/cashier/sales?${params}`);
      list.innerHTML = rows.length ? rows.map((sale) => { const locked = ['paid','void'].includes(sale.status); return `<div class="cashier-sale-row"><span><b>${esc(sale.invoice_number)}</b><small>${esc(window.cashierDateLabel(sale.created_at))}</small></span><span>${esc(sale.customer_name || 'Pelanggan umum')}<small>${esc(sale.cashier_name)}</small></span><span>${window.cashierMoney(sale.amount_paid)} dibayar<small>dari ${window.cashierMoney(sale.total)}</small></span><span class="cashier-status ${esc(sale.status)}">${statusLabel[sale.status] || esc(sale.status)}</span><button type="button" data-open-sale="${sale.id}">Detail / cetak</button><button type="button" data-update-payment="${sale.id}" ${locked ? 'disabled title="Nota lunas atau dibatalkan"' : ''}>Update pembayaran</button></div>`; }).join('') : '<div class="no-results">Belum ada nota yang cocok.</div>';
      list.querySelectorAll('[data-open-sale]').forEach((button) => button.addEventListener('click', () => openSale(button.dataset.openSale)));
      list.querySelectorAll('[data-update-payment]').forEach((button) => button.addEventListener('click', () => updatePayment(button.dataset.updatePayment)));
      $('#cashierSalesCount').textContent = `${rows.length} nota`;
    } catch (error) { list.innerHTML = `<div class="no-results">${esc(error.message)}</div>`; }
  }
  async function loadSummary(period = '7d') {
    const chart = $('#cashierSalesChart'); if (!chart) return;
    delete chart.dataset.fallback;
    chart.innerHTML = '<div class="no-results">Memuat data transaksi...</div>';
    try {
      let data;
      try {
        data = await window.cashierApi(`/api/cashier/summary?period=${encodeURIComponent(period)}`);
      } catch (summaryError) {
        // Older running backend instances may not yet expose /summary. Reuse the
        // authenticated real sales feed so the page still shows actual records.
        const sales = await window.cashierApi('/api/cashier/sales');
        const now = new Date(), dayStart = new Date(now); dayStart.setHours(0,0,0,0);
        const configs = { '1d': [24, 3600000], '7d': [7, 86400000], '30d': [30, 86400000], '1y': [122, 259200000] };
        const [count, step] = configs[period] || configs['7d'];
        const start = new Date(dayStart.getTime() - (period === '1d' ? 0 : (period === '1y' ? 364 : count - 1) * 86400000));
        const values = Array(count).fill(0), labels = values.map((_, i) => { const d = new Date(start.getTime() + i * step); return period === '1d' ? `${String(i).padStart(2,'0')}:00` : d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'}); });
        for (const sale of sales) {
          if (sale.status === 'void') continue;
          const date = new Date(`${String(sale.created_at).replace(' ','T')}Z`);
          const index = Math.floor((date - start) / step);
          if (index >= 0 && index < count) values[index] += Number(sale.amount_paid || 0);
        }
        const todayRows = sales.filter(sale => sale.status !== 'void' && new Date(`${String(sale.created_at).replace(' ','T')}Z`) >= new Date(dayStart.getTime() - 7*3600000));
        data = { values, labels, today: {count:todayRows.length, received:todayRows.reduce((sum,sale)=>sum+Number(sale.amount_paid||0),0)}, pending:sales.filter(sale=>['unpaid','partial'].includes(sale.status)).length };
        chart.dataset.fallback = 'true';
      }
      $('#summaryTodayCount').textContent = data.today.count.toLocaleString('id-ID');
      $('#summaryTodayRevenue').textContent = window.cashierMoney(data.today.received);
      $('#summaryPending').textContent = data.pending.toLocaleString('id-ID');
      $('#summaryAvg').textContent = window.cashierMoney(data.today.count ? data.today.received / data.today.count : 0);
      const values = data.values.map(Number), max = Math.max(...values, 1), width = 900, height = 270, pad = 28;
      const points = values.map((value, index) => `${pad + index * (width - 2 * pad) / Math.max(values.length - 1, 1)},${height - pad - value / max * (height - 2 * pad)}`).join(' ');
      const labels = data.labels;
      const indexes = [...new Set([0, Math.floor((labels.length - 1) / 3), Math.floor(2 * (labels.length - 1) / 3), labels.length - 1])];
      chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Grafik pemasukan dari pembayaran transaksi"><line x1="${pad}" y1="${height-pad}" x2="${width-pad}" y2="${height-pad}" stroke="#dce7e5"/><line x1="${pad}" y1="${pad}" x2="${width-pad}" y2="${pad}" stroke="#edf2f0"/><polyline points="${points}" fill="none" stroke="#187965" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${values.map((value,index)=>{const [x,y]=points.split(' ')[index].split(',');return `<circle cx="${x}" cy="${y}" r="3" fill="#187965"><title>${esc(labels[index])}: ${esc(window.cashierMoney(value))}</title></circle>`}).join('')}${indexes.map(i=>`<text x="${pad + i * (width - 2 * pad) / Math.max(labels.length - 1, 1)}" y="${height-5}" text-anchor="middle" fill="#64777b" font-size="12">${esc(labels[i])}</text>`).join('')}</svg><div class="cashier-chart-legend"><span></span> Pembayaran diterima</div>`;
      $('#summaryChartCaption').textContent = chart.dataset.fallback === 'true' ? 'Ringkasan transaksi nyata (pemasukan dikelompokkan berdasarkan tanggal nota)' : period === '1d' ? 'Per jam - hari ini' : period === '1y' ? 'Per 3 hari - 12 bulan terakhir' : period === '7d' ? 'Per hari - 7 hari terakhir' : 'Per hari - 30 hari terakhir';
    } catch (error) { chart.innerHTML = `<div class="no-results">Data ringkasan gagal dimuat: ${esc(error.message)}</div>`; }
  }
  function setWorkspaceHeader(page) {
    const header = $('#cashierGlobalPageHead');
    const stats = $('#cashierTopStats');
    const summary = page === 'summary';
    if (header) header.hidden = summary;
    if (stats) stats.hidden = summary || page === 'receipts';
    if (summary) return;
    const labels = {
      orders: ['RIWAYAT NOTA', 'Riwayat nota', 'Cari invoice, lihat detail, dan perbarui pembayaran.'],
      receipts: ['PENERIMAAN MATERIAL', 'Penerimaan material', 'Catat material masuk dan pantau perubahan stok.'],
      'web-orders': ['ORDER WEBSITE', 'Order web', 'Pesanan yang dibuat dan di-checkout pelanggan dari website.'],
      sale: ['PENJUALAN BARU', 'Penjualan baru', 'Pilih produk, periksa pesanan, lalu catat pembayaran.'],
    }[page] || ['PENJUALAN BARU', 'Penjualan baru', 'Pilih produk, periksa pesanan, lalu catat pembayaran.'];
    $('#cashierPageEyebrow').textContent = `FAZIMA PRINT / ${labels[0]}`;
    $('#cashierPageTitle').textContent = labels[1];
    $('#cashierPageDescription').textContent = labels[2];
  }
  async function loadSummaryOrders() {
    const list = $('#cashierSummaryOrders'); if (!list) return;
    list.innerHTML = '<div class="no-results">Memuat riwayat pesanan...</div>';
    try {
      const rows = await window.cashierApi('/api/cashier/sales');
      const recent = rows.slice(0, 5);
      list.innerHTML = recent.length ? recent.map(sale => `<article class="cashier-summary-order-item"><div><b>${esc(sale.invoice_number)}</b><small>${esc(sale.customer_name || 'Pelanggan umum')} - ${esc(window.cashierDateLabel(sale.created_at))}</small></div><strong>${window.cashierMoney(sale.amount_paid)} <small>dari ${window.cashierMoney(sale.total)}</small></strong><span class="cashier-status ${esc(sale.status)}">${statusLabel[sale.status] || esc(sale.status)}</span><button class="cashier-inline-button" type="button" data-summary-open="${sale.id}">Detail</button></article>`).join('') : '<div class="no-results">Belum ada pesanan.</div>';
      list.querySelectorAll('[data-summary-open]').forEach(button => button.addEventListener('click', () => openSale(button.dataset.summaryOpen)));
    } catch (error) { list.innerHTML = `<div class="no-results">Riwayat gagal dimuat: ${esc(error.message)}</div>`; }
  }
  function showSummary() {
    currentPage = 'summary';
    setWorkspaceHeader('summary');
    content.innerHTML = `<section class="cashier-summary-page"><div class="cashier-summary-head"><div><p class="eyebrow">LAPORAN / PEMASUKAN</p><h2>Ringkasan <em>penjualan.</em></h2><p>Pemasukan dihitung dari pembayaran yang tercatat di nota Kasir.</p></div><button id="refreshSummary" class="secondary-button" type="button">Perbarui data</button></div><div class="cashier-summary-kpis"><article><span>Transaksi hari ini</span><b id="summaryTodayCount">...</b><small>Nota aktif dibuat hari ini</small></article><article><span>Pemasukan hari ini</span><b id="summaryTodayRevenue">...</b><small>Total pembayaran diterima</small></article><article><span>Nota menunggu pembayaran</span><b id="summaryPending">...</b><small>Belum lunas, seluruh periode</small></article><article><span>Rata-rata per transaksi</span><b id="summaryAvg">...</b><small>Pembayaran hari ini / transaksi hari ini</small></article></div><section class="cashier-summary-chart"><header><div><h3>Tren pembayaran</h3><p id="summaryChartCaption">Memuat...</p></div><div class="cashier-period-tabs" role="group" aria-label="Periode grafik"><button data-period="1d" type="button">1 hari</button><button data-period="7d" class="active" type="button">7 hari</button><button data-period="30d" type="button">30 hari</button><button data-period="1y" type="button">1 tahun</button></div></header><div id="cashierSalesChart"></div></section><section class="cashier-summary-orders"><header><div><h3>Riwayat pesanan</h3><p>Lima invoice terbaru</p></div><button id="summaryViewAllOrders" class="secondary-button" type="button">Lihat semua</button></header><div id="cashierSummaryOrders"><div class="no-results">Memuat riwayat pesanan...</div></div></section></section>`;
    const load = (period) => { document.querySelectorAll('[data-period]').forEach(button => button.classList.toggle('active', button.dataset.period === period)); loadSummary(period); };
    document.querySelectorAll('[data-period]').forEach(button => button.addEventListener('click', () => load(button.dataset.period)));
    $('#refreshSummary').addEventListener('click', () => load(document.querySelector('[data-period].active')?.dataset.period || '7d'));
    load('7d');
    loadSummaryOrders();
    $('#summaryViewAllOrders').addEventListener('click', () => document.querySelector('.cashier-nav[data-page="orders"]')?.click());
  }
  function showHistory() {
    currentPage = 'orders';
    setWorkspaceHeader('orders');
    content.innerHTML = `<div class="cashier-history-card"><div class="cashier-history-title-row"><h2 class="cashier-view-title">Riwayat <em>nota.</em></h2><span id="cashierSalesCount" class="cashier-sales-count-badge">Memuat...</span></div><p class="cashier-meta-line">Cari nota, lihat detail, dan perbarui pembayaran.</p><div class="cashier-history-tools"><input id="cashierSalesSearch" class="cashier-search" type="search" placeholder="Cari nomor nota atau customer"><select id="cashierSalesStatus">${statusFilter}</select></div><div id="cashierSalesList"></div></div>`;
    $('#cashierSalesSearch').addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(loadSales, 250); });
    $('#cashierSalesStatus').addEventListener('change', loadSales); loadSales();
  }
  let receiptMaterials = [];
  let receiptSearchQuery = '';
  const quantityLabel = (value) => Number(value || 0).toLocaleString('id-ID', {maximumFractionDigits:3});
  function renderReceiptMaterials() {
    const list = $('#cashierMaterialStockList');
    if (!list) return;
    const query = receiptSearchQuery.trim().toLocaleLowerCase('id-ID');
    const filteredMaterials = receiptMaterials.filter((material) => !query || `${material.name} ${material.code}`.toLocaleLowerCase('id-ID').includes(query));
    list.innerHTML = filteredMaterials.length ? filteredMaterials.map((material) => `<article class="cashier-material-stock-row"><div><b>${esc(material.name)}</b><small>${esc(material.code)} · ${esc(material.unit || 'Tanpa satuan')}</small></div><strong>${quantityLabel(material.stock)} <small>${esc(material.unit || '')}</small></strong><div class="cashier-material-row-actions"><button type="button" class="cashier-inline-button" data-select-material="${material.id}">Pilih</button><button type="button" class="cashier-check-button" data-check-material="${material.id}">Cek</button></div></article>`).join('') : `<div class="no-results">${query ? 'Material tidak ditemukan.' : 'Belum ada material aktif.'}</div>`;
    list.querySelectorAll('[data-select-material]').forEach((button) => button.addEventListener('click', () => {
      const select = $('#cashierMaterialReceiptForm')?.elements.material_id;
      if (select) { select.value = button.dataset.selectMaterial; updateReceiptPreview(); select.focus(); }
      $('#cashierMaterialReceiptForm')?.scrollIntoView({behavior:'smooth',block:'center'});
    }));
    list.querySelectorAll('[data-check-material]').forEach((button) => button.addEventListener('click', () => openMaterialCheck(button.dataset.checkMaterial)));
  }
  function renderReceiptHistory(rows) {
    const list = $('#cashierMaterialReceiptHistory');
    if (!list) return;
    list.innerHTML = rows.length ? rows.map((row) => `<article class="cashier-material-receipt-row"><span><b>${esc(row.material_name)}</b><small>${esc(row.material_code)} · ${esc(window.cashierDateLabel(row.created_at))}</small></span><strong>+${quantityLabel(row.quantity)} <small>${esc(row.unit)}</small></strong><span><b>${quantityLabel(row.balance_before)} → ${quantityLabel(row.balance_after)} ${esc(row.unit)}</b><small>Stok sebelum → sesudah</small></span><span><b>${esc(row.reference || 'Tanpa referensi')}</b><small>${esc(row.receiver_name)}${row.note ? ` · ${esc(row.note)}` : ''}</small></span></article>`).join('') : '<div class="no-results">Belum ada penerimaan material.</div>';
  }
  async function openMaterialCheck(materialId) {
    const modal = $('#cashierMaterialCheckModal');
    const body = $('#cashierMaterialCheckContent');
    if (!modal || !body) return;
    modal.hidden = false;
    body.innerHTML = '<div class="no-results">Memuat saldo dan riwayat stok...</div>';
    try {
      const data = await window.cashierApi(`/api/cashier/materials/${encodeURIComponent(materialId)}/history`);
      const material = data.material;
      const movements = [...(data.history || [])].sort((a,b) => {
        if (a.recorded_at && b.recorded_at) return String(b.recorded_at).localeCompare(String(a.recorded_at));
        if (a.recorded_at) return -1;
        if (b.recorded_at) return 1;
        return 0;
      });
      const typeLabels = {opening:'Saldo awal',in:'Stok masuk',out:'Stok keluar',adjustment:'Penyesuaian'};
      body.innerHTML = `<div class="cashier-stock-detail-heading"><div><p class="eyebrow">${esc(material.code)} · ${esc(material.status)}</p><h2 id="cashierStockCheckTitle">${esc(material.name)}</h2><p>Satuan: ${esc(material.unit || '—')}</p></div><strong>${quantityLabel(material.current)} <small>${esc(material.unit || '')}</small><span>Stok saat ini</span></strong></div><div class="cashier-stock-detail-stats"><article><span>Saldo awal</span><b>${quantityLabel(material.opening)} ${esc(material.unit)}</b></article><article><span>Total masuk</span><b>${quantityLabel(material.incoming)} ${esc(material.unit)}</b></article><article><span>Total keluar</span><b>${quantityLabel(material.outgoing)} ${esc(material.unit)}</b></article><article><span>Penyesuaian</span><b>${quantityLabel(material.adjustment)} ${esc(material.unit)}</b></article><article><span>Saldo akhir</span><b>${quantityLabel(material.current)} ${esc(material.unit)}</b></article></div><section class="cashier-stock-flow"><header><div><h3>Flow history stok</h3><p>Transaksi rinci dan akumulasi dari data awal.</p></div><span>${movements.length.toLocaleString('id-ID')} catatan</span></header>${movements.length ? `<div class="cashier-stock-flow-list">${movements.map((row) => { const type=row.kind || 'adjustment'; const sign=type==='in'?'+':type==='out'?'−':''; const time=row.recorded_at?window.cashierDateLabel(row.recorded_at):'Waktu transaksi tidak tercatat'; return `<article class="cashier-stock-flow-row ${esc(type)}"><span class="cashier-stock-flow-type">${esc(typeLabels[type] || typeLabels.adjustment)}</span><strong>${sign}${quantityLabel(row.quantity)} <small>${esc(material.unit)}</small></strong><span><b>${row.balance_before == null ? '—' : quantityLabel(row.balance_before)} → ${row.balance_after == null ? '—' : quantityLabel(row.balance_after)}</b><small>Saldo sebelum → sesudah</small></span><span><b>${esc(row.reference || row.source || (row.recorded_at ? 'Penerimaan material' : 'Data awal'))}</b><small>${esc(time)}${row.actor ? ` · ${esc(row.actor)}` : ''}${row.note ? ` · ${esc(row.note)}` : ''}</small></span></article>`; }).join('')}</div>` : '<div class="no-results">Belum ada riwayat pergerakan stok untuk material ini.</div>'}<p class="cashier-stock-flow-note">Riwayat lama hanya tersedia sebagai akumulasi jika tanggal/transaksi rinci tidak tersimpan pada data material.</p></section>`;
    } catch (error) {
      body.innerHTML = `<div class="no-results">Detail stok gagal dimuat: ${esc(error.message)}</div>`;
    }
  }
  function updateReceiptPreview() {
    const form = $('#cashierMaterialReceiptForm');
    if (!form) return;
    const material = receiptMaterials.find((item) => String(item.id) === form.elements.material_id.value);
    const quantity = Number(String(form.elements.quantity.value || '').replace(',', '.'));
    const preview = $('#cashierMaterialReceiptPreview');
    if (!material) { preview.textContent = 'Pilih material untuk melihat stok terkini.'; return; }
    const after = Number(material.stock) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    preview.innerHTML = `Stok sekarang <b>${quantityLabel(material.stock)} ${esc(material.unit)}</b>${quantity > 0 ? ` · Setelah diterima <b>${quantityLabel(after)} ${esc(material.unit)}</b>` : ''}`;
  }
  async function loadReceiptData() {
    const form = $('#cashierMaterialReceiptForm');
    const history = $('#cashierMaterialReceiptHistory');
    if (!form || !history) return;
    history.innerHTML = '<div class="no-results">Memuat riwayat penerimaan...</div>';
    try {
      const materials = await window.cashierApi('/api/cashier/materials');
      const receipts = await window.cashierApi('/api/cashier/receipts');
      const safeReceipts = Array.isArray(receipts) ? receipts : [];
      receiptMaterials = Array.isArray(materials) ? materials : [];
      form.elements.material_id.innerHTML = '<option value="">Pilih material</option>' + receiptMaterials.map((item) => `<option value="${item.id}">${esc(item.name)} · ${esc(item.code)} · stok ${quantityLabel(item.stock)} ${esc(item.unit)}</option>`).join('');
      $('#cashierMaterialCount').textContent = receiptMaterials.length.toLocaleString('id-ID');
      const nowKey = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
      const todayReceipts = safeReceipts.filter((row) => {
        const date = new Date(`${String(row.created_at).replace(' ','T')}Z`);
        return !Number.isNaN(date.getTime()) && new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date) === nowKey;
      });
      $('#cashierReceiptCount').textContent = todayReceipts.length.toLocaleString('id-ID');
      $('#cashierReceiptLatest').textContent = safeReceipts.length ? window.cashierDateLabel(safeReceipts[0].created_at) : 'Belum ada data';
      renderReceiptMaterials(); renderReceiptHistory(safeReceipts); updateReceiptPreview();
    } catch (error) {
      history.innerHTML = `<div class="no-results">Data penerimaan gagal dimuat: ${esc(error.message)}</div>`;
      $('#cashierMaterialStockList').innerHTML = '<div class="no-results">Daftar material tidak dapat dimuat.</div>';
    }
  }
  function showReceipts() {
    currentPage = 'receipts';
    setWorkspaceHeader('receipts');
    content.innerHTML = `<section class="cashier-material-page"><div class="cashier-material-kpis"><article><span>Material aktif</span><b id="cashierMaterialCount">—</b><small>Siap menerima stok</small></article><article><span>Penerimaan hari ini</span><b id="cashierReceiptCount">—</b><small>Catatan stok masuk hari ini</small></article><article><span>Penerimaan terbaru</span><b id="cashierReceiptLatest">—</b><small>Waktu pencatatan terakhir</small></article></div><div class="cashier-material-grid"><form id="cashierMaterialReceiptForm" class="cashier-material-card"><header><p class="eyebrow">STOK / BARANG MASUK</p><h2>Catat penerimaan</h2><p>Stok material diperbarui saat penerimaan disimpan.</p></header><label>Material<select name="material_id" required><option value="">Memuat material...</option></select></label><label>Jumlah diterima<input name="quantity" type="number" min="0.001" step="0.001" inputmode="decimal" placeholder="Contoh: 25" required></label><div id="cashierMaterialReceiptPreview" class="cashier-material-preview">Pilih material untuk melihat stok terkini.</div><label>Referensi <small>(opsional)</small><input name="reference" maxlength="120" placeholder="Nomor nota supplier"></label><label>Catatan <small>(opsional)</small><textarea name="note" rows="3" maxlength="1000" placeholder="Supplier atau keterangan penerimaan"></textarea></label><button class="primary-button" type="submit">Simpan penerimaan</button><small id="cashierMaterialReceiptMessage" class="cashier-message" role="status" aria-live="polite"></small></form><section class="cashier-material-card"><header><p class="eyebrow">STOK MATERIAL</p><h2>Saldo saat ini</h2><p>Pilih item untuk form penerimaan atau cek stok.</p></header><label class="cashier-material-search-label" for="cashierMaterialSearch">Cari material</label><input id="cashierMaterialSearch" class="cashier-material-search" type="search" placeholder="Nama atau kode material" autocomplete="off"><div id="cashierMaterialStockList" class="cashier-material-stock-list"><div class="no-results">Memuat material...</div></div></section></div><section class="cashier-material-card cashier-material-history"><header><div><p class="eyebrow">AUDIT / STOK MASUK</p><h2>Riwayat penerimaan</h2><p>Catatan material masuk beserta perubahan saldo stok.</p></div><button id="cashierMaterialRefresh" type="button" class="secondary-button">Perbarui</button></header><div id="cashierMaterialReceiptHistory" class="cashier-material-receipt-list"></div></section><div id="cashierMaterialCheckModal" class="cashier-stock-check-backdrop" hidden><section class="cashier-stock-check-dialog" role="dialog" aria-modal="true" aria-labelledby="cashierStockCheckTitle"><button type="button" class="cashier-stock-check-close" aria-label="Tutup" data-close-stock-check>×</button><div id="cashierMaterialCheckContent"><div class="no-results">Memuat saldo dan riwayat stok...</div></div></section></div></section>`;
    const form = $('#cashierMaterialReceiptForm');
    form.elements.material_id.addEventListener('change', updateReceiptPreview);
    form.elements.quantity.addEventListener('input', updateReceiptPreview);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = $('#cashierMaterialReceiptMessage');
      const submit = form.querySelector('[type="submit"]');
      const quantity = Number(String(form.elements.quantity.value).replace(',', '.'));
      if (!Number.isFinite(quantity) || quantity <= 0 || Math.round(quantity * 1000) !== quantity * 1000) {
        message.textContent = 'Jumlah harus lebih dari 0 dan maksimal 3 angka desimal.'; return;
      }
      message.textContent = '';
      submit.disabled = true; submit.textContent = 'Menyimpan...';
      try {
        await window.cashierApi('/api/cashier/receipts', {method:'POST',body:JSON.stringify({material_id:Number(form.elements.material_id.value),quantity,reference:form.elements.reference.value,note:form.elements.note.value})});
        const selectedMaterial = form.elements.material_id.value;
        form.reset();
        await loadReceiptData();
        if (receiptMaterials.some((item) => String(item.id) === selectedMaterial)) form.elements.material_id.value = selectedMaterial;
        updateReceiptPreview();
        window.cashierToast('Penerimaan tersimpan dan stok material diperbarui.');
      } catch (error) { message.textContent = error.message; }
      finally { submit.disabled = false; submit.textContent = 'Simpan penerimaan'; }
    });
    $('#cashierMaterialRefresh').addEventListener('click', loadReceiptData);
    $('#cashierMaterialSearch').addEventListener('input', (event) => { receiptSearchQuery = event.target.value; renderReceiptMaterials(); });
    $('#cashierMaterialCheckModal').addEventListener('click', (event) => { if (event.target.id === 'cashierMaterialCheckModal' || event.target.closest('[data-close-stock-check]')) $('#cashierMaterialCheckModal').hidden = true; });
    loadReceiptData();
  }
  document.querySelectorAll('.cashier-nav[data-page]').forEach((button) => button.addEventListener('click', () => {
    currentPage = button.dataset.page;
    sessionStorage.setItem('cashier.currentPage', currentPage);
    document.querySelectorAll('.cashier-nav[data-page]').forEach((nav) => nav.classList.toggle('active', nav === button));
    if (currentPage === 'orders') showHistory();
    else if (currentPage === 'web-orders') showWebOrders();
    else if (currentPage === 'summary') showSummary();
    else if (currentPage === 'receipts') showReceipts();
    else location.reload();
  }));
  const initializeCashierPage = () => {
    const savedPage = sessionStorage.getItem('cashier.currentPage');
    const page = ['sale','orders','summary','receipts','web-orders'].includes(savedPage) ? savedPage : 'summary';
    currentPage = page;
    setWorkspaceHeader(page);
    document.querySelectorAll('.cashier-nav[data-page]').forEach((nav) => nav.classList.toggle('active', nav.dataset.page === page));
    if (page === 'summary') showSummary();
    else if (page === 'orders') showHistory();
    else if (page === 'web-orders') showWebOrders();
    else if (page === 'receipts') showReceipts();
    window.cashierRevealApp?.();
    refreshWebOrderBadge();
  };
  window.addEventListener('cashier:initialized', initializeCashierPage, {once:true});
  if (window.cashierInitialized) initializeCashierPage();
  window.setInterval(() => refreshWebOrderBadge(true), 20000);
  window.addEventListener('cashier:sale-created', () => { if (currentPage === 'orders') loadSales(); else if (currentPage === 'summary') loadSummary(document.querySelector('[data-period].active')?.dataset.period || '7d'); });
})();
