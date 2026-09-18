(() => {
  const sidebar = document.querySelector('.master-sidebar nav');
  const content = document.querySelector('#viewContent');
  if (!sidebar || !content) return;
  const nav = document.createElement('button');
  nav.className = 'nav-item'; nav.dataset.view = 'stock'; nav.innerHTML = '<span>▥</span> Stok & pergerakan';
  sidebar.querySelector('[data-view="products"]')?.before(nav);
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const money = (value) => Number(value || 0).toLocaleString('id-ID', {maximumFractionDigits: 2});
  const toast = (message) => { const node = $('#toast'); node.textContent = message; node.classList.add('show'); setTimeout(() => node.classList.remove('show'), 2600); };
  const api = async (path, options = {}) => { const response = await fetch(path, options); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Permintaan stok gagal'); return body; };
  const render = async () => {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item === nav));
    content.innerHTML = '<div class="view-header"><div><p class="eyebrow">DATA OPERASIONAL / INVENTORY</p><h1>Stok & <em>pergerakan.</em></h1><p>Master Data membaca saldo bahan dan histori transaksi dari database stok operator.</p></div><button id="masterStockRefresh" class="secondary-button" type="button">Refresh data ↻</button></div><div id="masterStockSummary" class="stock-metrics"><div class="metric-card"><span class="metric-label">Memuat...</span></div></div><div class="stock-master-grid"><section class="surface-card stock-table-card"><div class="surface-title"><div><p class="eyebrow">SEMUA BAHAN</p><h2>Daftar stok gabungan</h2></div><button id="masterStockAdd" class="primary-button" type="button">+ Tambah bahan</button></div><div class="stock-table"><div class="stock-row stock-heading"><span>Bahan</span><span>Kategori</span><span>Satuan</span><span>Saldo</span><span>Status</span></div><div id="masterStockRows"></div></div></section><section class="surface-card stock-log"><div class="surface-title"><div><p class="eyebrow">AUDIT TRAIL</p><h2>Pergerakan terakhir</h2></div></div><div id="masterStockMovements"><div class="empty">Memuat pergerakan...</div></div></section></div>';
    const [summary, rows, movements] = await Promise.all([api('/api/stock/summary'), api('/api/stock'), api('/api/stock/movements?limit=30')]);
    $('#masterStockSummary').innerHTML = `<div class="metric-card"><span class="metric-label">Total bahan</span><strong>${summary.items}</strong><small>Terdaftar</small></div><div class="metric-card"><span class="metric-label">Saldo tercatat</span><strong>${money(summary.quantity)}</strong><small>Gabungan satuan</small></div><div class="metric-card warning"><span class="metric-label">Perlu restock</span><strong>${summary.low_stock}</strong><small>Di bawah minimum</small></div><div class="metric-card"><span class="metric-label">Aktivitas stok</span><strong>${summary.movements}</strong><small>Total histori</small></div>`;
    $('#masterStockRows').innerHTML = rows.map((row) => `<div class="stock-row"><span><b>${esc(row.name)}</b><small>${esc(row.id)}</small></span><span>${row.categories.map(esc).join(' · ')}</span><span>${esc(row.unit)}</span><strong>${money(row.quantity)}</strong><span class="stock-status ${row.low_stock ? 'low' : 'ok'}">${row.low_stock ? 'Restock' : 'Aman'}</span></div>`).join('');
    $('#masterStockMovements').innerHTML = movements.length ? movements.map((row) => `<div class="stock-log-row"><span class="log-${row.movement_type}">${row.movement_type === 'in' ? '+' : row.movement_type === 'out' ? '−' : '='}${money(row.quantity)}</span><p><b>${esc(row.name)}</b><small>${esc(row.category || 'Umum')} · saldo ${money(row.balance_after)} ${esc(row.unit)} · ${new Date(row.created_at).toLocaleString('id-ID')}</small></p></div>`).join('') : '<div class="empty">Belum ada pergerakan stok.</div>';
    $('#masterStockRefresh').addEventListener('click', () => render().then(() => toast('Stok diperbarui.')).catch((error) => toast(error.message)));
    $('#masterStockAdd').addEventListener('click', () => toast('Tambah bahan tersedia di Dashboard Operator untuk mencatat kategori dan stok awal.'));
  };
  nav.addEventListener('click', (event) => { event.preventDefault(); event.stopImmediatePropagation(); render().catch((error) => { content.innerHTML = `<div class="info-banner"><span>!</span><p>${esc(error.message)}</p></div>`; }); }, true);
})();
