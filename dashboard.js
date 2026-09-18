const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[c]));
let toastTimer;

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}

function applyTheme(theme) {
  const dark = theme === 'dark';
  document.body.classList.toggle('dark-theme', dark);
  const toggle = $('#themeToggle');
  if (toggle) {
    toggle.textContent = dark ? '☀' : '☾';
    toggle.title = dark ? 'Light mode' : 'Dark mode';
    toggle.setAttribute('aria-label', dark ? 'Aktifkan light mode' : 'Aktifkan dark mode');
  }
}

function applyLightTheme() {
  document.body.classList.remove('dark-theme');
  const toggle = $('#themeToggle');
  if (toggle) toggle.hidden = true;
}

async function api(path, options = {}) {
  const response = await fetch(path, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Request gagal (${response.status})`);
  return body;
}

let products = [];

function renderProducts(items) {
  products = items;
  $('#presetProduct').innerHTML = items.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.name)}</option>`).join('');
}

function renderPresetDashboard(items) {
  const groups = products.map((product) => {
    const sizes = items.filter((item) => item.product === product.name);
    return `<div class="preset-group"><h3>${escapeHtml(product.name)}</h3>${sizes.length ? sizes.map((item) => `<div class="preset-item"><span>${escapeHtml(item.size)}</span><button class="preset-delete" type="button" data-preset-id="${item.id}" title="Hapus preset">×</button></div>`).join('') : '<div class="empty">Belum ada preset</div>'}</div>`;
  }).join('');
  $('#presetList').innerHTML = groups;
  $('#presetList').querySelectorAll('[data-preset-id]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('Hapus preset ukuran ini?')) return;
    try {
      await api(`/api/size-presets/${button.dataset.presetId}`, { method: 'DELETE' });
      await refreshProductData();
      toast('Preset ukuran dihapus.');
    } catch (error) {
      toast(error.message);
    }
  }));
}

async function refreshProductData() {
  const items = await api('/api/products');
  renderProducts(items);
  renderPresetDashboard(await api('/api/size-presets'));
}

function renderHistory(items) {
  $('#historyList').innerHTML = items.length ? items.map((item) => `<article class="history-item"><div><b>${escapeHtml(item.output_name)}</b><span>${escapeHtml(item.customer_name)} · ${escapeHtml(item.product)} · ${escapeHtml(item.size)}</span><small>${escapeHtml(item.created)} · ${item.rename_enabled ? 'nama customer' : 'nama default'}</small></div><div class="history-links"><a href="/api/layouts/${encodeURIComponent(item.id)}/files/output">output</a><a href="/api/layouts/${encodeURIComponent(item.id)}/files/detail">detail.txt</a></div></article>`).join('') : '<div class="empty">Belum ada layout yang dibuat.</div>';
}

async function refreshHistory() {
  renderHistory(await api('/api/layouts'));
}

applyLightTheme();
$('#refresh').addEventListener('click', async () => {
  try {
    await refreshHistory();
    toast('Riwayat diperbarui.');
  } catch (error) {
    toast(error.message);
  }
});
$('#themeToggle')?.addEventListener('click', () => {
  const theme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
  localStorage.setItem('pressly-theme', theme);
  applyTheme(theme);
});
$('#presetForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    await api('/api/size-presets', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ product: $('#presetProduct').value, width: $('#presetWidth').value, height: $('#presetHeight').value, unit: $('#presetUnit').value }),
    });
    $('#presetWidth').value = '';
    $('#presetHeight').value = '';
    await refreshProductData();
    toast('Preset ukuran ditambahkan.');
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});
Promise.all([refreshProductData(), refreshHistory()]).catch(() => toast('Backend belum berjalan. Jalankan python3 backend.py.'));
