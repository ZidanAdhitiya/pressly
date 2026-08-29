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
  toggle.textContent = dark ? '☀' : '☾';
  toggle.title = dark ? 'Light mode' : 'Dark mode';
  toggle.setAttribute('aria-label', dark ? 'Aktifkan light mode' : 'Aktifkan dark mode');
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
  $('#product').innerHTML = '<option value="">Pilih tipe</option>' + items.map((product) => `<option value="${escapeHtml(product.name)}">${escapeHtml(product.name)}</option>`).join('');
}

function renderSizes(productName) {
  const product = products.find((item) => item.name === productName);
  const select = $('#sizePreset');
  select.innerHTML = product ? product.sizes.map((size) => `<option value="${escapeHtml(size)}">${escapeHtml(size)}</option>`).join('') : '<option value="">Pilih tipe dulu</option>';
  syncSize();
}

function syncSize() {
  const preset = $('#sizePreset').value;
  const custom = preset === 'Custom';
  $('#sizeCustom').hidden = !custom;
  $('#size').value = custom ? $('#sizeCustom').value : preset;
}

function showFileInfo(file) {
  const dimensions = $('#fileDimensions');
  if (!file) {
    dimensions.textContent = 'Ukuran desain belum dibaca';
    return;
  }
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name);
  if (!isImage) {
    dimensions.textContent = `${sizeMb} MB · PDF — ukuran halaman dibaca saat processing`;
    return;
  }
  const image = new Image();
  const objectUrl = URL.createObjectURL(file);
  image.onload = () => {
    dimensions.textContent = `${sizeMb} MB · ${image.naturalWidth} × ${image.naturalHeight} px`;
    URL.revokeObjectURL(objectUrl);
  };
  image.onerror = () => {
    dimensions.textContent = `${sizeMb} MB · dimensi gambar tidak dapat dibaca`;
    URL.revokeObjectURL(objectUrl);
  };
  image.src = objectUrl;
}

function selectFile(file) {
  if (!file) {
    showFileInfo(null);
    return;
  }
  $('#fileName').textContent = file.name;
  showFileInfo(file);
}

async function refreshProductData() {
  renderProducts(await api('/api/products'));
}

applyLightTheme();
$('#product').addEventListener('change', (event) => renderSizes(event.target.value));
$('#sizePreset').addEventListener('change', syncSize);
$('#sizeCustom').addEventListener('input', syncSize);
$('#file').addEventListener('change', (event) => selectFile(event.target.files[0]));
$('#dropzone').addEventListener('dragover', (event) => { event.preventDefault(); $('#dropzone').classList.add('dragging'); });
$('#dropzone').addEventListener('dragleave', () => $('#dropzone').classList.remove('dragging'));
$('#dropzone').addEventListener('drop', (event) => {
  event.preventDefault();
  $('#dropzone').classList.remove('dragging');
  const file = event.dataTransfer.files[0];
  if (file) {
    const input = $('#file');
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    selectFile(file);
  }
});
$('#layoutForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const formElement = event.currentTarget;
  const file = $('#file').files[0];
  if (!file) return toast('Pilih file desain terlebih dahulu.');
  const form = new FormData(formElement);
  form.set('scale_up', $('#scaleUp').checked ? 'true' : 'false');
  const button = formElement.querySelector('button[type=submit]');
  button.disabled = true;
  button.innerHTML = 'Memproses layout <span>…</span>';
  try {
    const result = await api('/api/layouts', { method: 'POST', body: form });
    $('#result').hidden = false;
    $('#result').innerHTML = `<b>Layout selesai</b><span>${escapeHtml(result.output_name)}</span><small>Format: ${escapeHtml(result.output_format || 'PDF')} · Warna: ${escapeHtml(result.color_mode)} · Scale up: ${result.scale_up ? 'aktif' : 'nonaktif'}</small><a href="/api/layouts/${encodeURIComponent(result.id)}/files/output">Download output →</a>`;
    toast(`${result.id} tersimpan di folder lokal.`);
    formElement.reset();
    $('#fileName').textContent = 'Belum ada file';
    $('#fileDimensions').textContent = 'Ukuran desain belum dibaca';
    $('#sizePreset').innerHTML = '<option value="">Pilih tipe dulu</option>';
    $('#sizeCustom').hidden = true;
    $('#size').value = '';
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Buat layout <span>→</span>';
  }
});
$('#themeToggle').addEventListener('click', () => {
  const theme = document.body.classList.contains('dark-theme') ? 'light' : 'dark';
  localStorage.setItem('pressly-theme', theme);
  applyTheme(theme);
});
refreshProductData().catch(() => toast('Backend belum berjalan. Jalankan python3 backend.py.'));
