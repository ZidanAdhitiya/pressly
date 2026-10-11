const $ = (s) => document.querySelector(s);
const view = new URLSearchParams(location.search).get('view') || 'overview';
const viewMap = {overview:['overview','.quick-stats'],hero:['hero'],catalog:['catalog'],promotions:['promotions'],orders:['orders'],chat:['chat']};
document.querySelector('#chat')?.remove();
document.body.dataset.view = view;
document.querySelectorAll('.control-sidebar nav a').forEach((link) => { const target = (link.getAttribute('href') || '').split('#')[1]; link.classList.toggle('active', target === view); link.href = `website-dashboard.html?view=${target}`; });
if (view === 'overview') { const status = $('#health'); const navbarMeta = document.querySelector('.global-meta'); if (status && navbarMeta) { status.hidden = false; status.className = 'navbar-health-status'; status.setAttribute('role','status'); navbarMeta.prepend(status); } }
if (view !== 'overview') { document.querySelector('.quick-stats')?.setAttribute('hidden',''); document.querySelectorAll('.control-panel').forEach((panel) => { if (!viewMap[view]?.includes(panel.id)) panel.setAttribute('hidden',''); }); }
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path) { const response = await fetch(path, {cache:'no-store'}); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || `Request gagal (${response.status})`); return body; }
const money = (v) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0));
let catalogCache = [];
let categoryCache = [];
async function save(path, payload) { const response = await fetch(path, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)}); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Perubahan gagal disimpan'); }
async function remove(path) { const response = await fetch(path, {method:'DELETE'}); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Penghapusan gagal'); }
const categoryOptions = (selected = '') => `<option value="" disabled ${selected ? '' : 'selected'}>Pilih kategori</option>${categoryCache.map((item) => `<option value="${esc(item.slug)}" ${item.slug === selected ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}`;
function applyCategorySelects() { document.querySelectorAll('.catalog-editor input[name="category"], .product-create-form input[name="category"]').forEach((input) => { const select = document.createElement('select'); select.name = 'category'; select.innerHTML = categoryOptions(input.value); input.replaceWith(select); }); }
function renderCategorySettings(rows) { categoryCache = rows; const target = $('#categorySettings'); if (!target) return; target.innerHTML = `<details class="category-settings-details"><summary>Category settings <span>${rows.length} kategori</span></summary><div class="category-settings-body"><form id="newCategoryForm"><input name="name" placeholder="Nama kategori baru" required><input name="sort_order" type="number" value="0" aria-label="Urutan"><button class="section-action" type="submit">Tambah kategori</button></form><div class="category-settings-list">${rows.map((row) => `<div class="category-setting-row" data-category-id="${row.id || ''}"><input name="name" value="${esc(row.name)}" data-category-name><button type="button" class="secondary" data-save-category>Simpan</button>${row.id ? `<button type="button" class="danger-action" data-delete-category>Hapus</button>` : ''}</div>`).join('')}</div></div></details>`; applyCategorySelects(); $('#newCategoryForm')?.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); try { const response = await fetch('/api/website/categories', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:data.get('name'),sort_order:Number(data.get('sort_order') || 0)})}); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Kategori gagal dibuat'); await loadCategories(); } catch (error) { alert(error.message); } }); target.querySelectorAll('[data-save-category]').forEach((button) => button.addEventListener('click', async () => { const row = button.closest('[data-category-id]'); try { await save(`/api/website/categories/${row.dataset.categoryId}`, {name:row.querySelector('[data-category-name]').value}); await loadCategories(); } catch (error) { alert(error.message); } })); target.querySelectorAll('[data-delete-category]').forEach((button) => button.addEventListener('click', async () => { const row = button.closest('[data-category-id]'); if (!confirm('Hapus kategori ini?')) return; try { await remove(`/api/website/categories/${row.dataset.categoryId}`); await loadCategories(); } catch (error) { alert(error.message); } })); }
async function loadCategories() { try { const rows = await api('/api/website/categories'); renderCategorySettings(rows); } catch (error) { const target = $('#categorySettings'); if (target) target.innerHTML = `<div class="category-migration-note">${esc(error.message)} Jalankan <code>migrate_catalog.sql</code> sebagai database admin.</div>`; } }
function readImageData(file) { return new Promise((resolve, reject) => { if (!file) return resolve(''); const reader = new FileReader(); reader.onload = () => resolve(String(reader.result || '')); reader.onerror = reject; reader.readAsDataURL(file); }); }
const maxHeroSlides = 8;
const maxHeroImageBytes = 3 * 1024 * 1024;
let heroSlides = [];
function heroImageUrl(slide) { return slide.image_data || `/api/website/hero-image?path=${encodeURIComponent(slide.image || '')}`; }
function setHeroMessage(message, error = false, success = false) { const node = $('#heroEditorMessage'); if (!node) return; node.textContent = message; node.className = `hero-editor-message${error ? ' error' : success ? ' success' : ''}`; }
function renderHeroSlides() {
  const list = $('#heroSlideList');
  if (!list) return;
  list.innerHTML = heroSlides.map((slide, index) => `<article class="hero-slide-item"><img class="hero-slide-preview" src="${esc(heroImageUrl(slide))}" alt="Preview ${esc(slide.alt || `gambar ${index + 1}`)}"><div class="hero-slide-fields"><label>Ganti gambar<input type="file" accept="image/png,image/jpeg,image/webp" data-hero-file="${index}"></label><label>Teks alternatif<input type="text" maxlength="180" value="${esc(slide.alt || '')}" data-hero-alt="${index}" placeholder="Contoh hasil cetak Fazima Print"></label><div class="hero-slide-actions"><button class="table-button" type="button" data-hero-move="up" data-hero-index="${index}" ${index === 0 ? 'disabled' : ''}>Naik</button><button class="table-button" type="button" data-hero-move="down" data-hero-index="${index}" ${index === heroSlides.length - 1 ? 'disabled' : ''}>Turun</button><button class="danger-action" type="button" data-hero-remove="${index}" ${heroSlides.length === 1 ? 'disabled' : ''}>Hapus</button></div></div></article>`).join('');
  list.querySelectorAll('[data-hero-alt]').forEach((input) => input.addEventListener('input', () => { heroSlides[Number(input.dataset.heroAlt)].alt = input.value; }));
  list.querySelectorAll('[data-hero-file]').forEach((input) => input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; if (file.size > maxHeroImageBytes) { setHeroMessage('Ukuran setiap gambar maksimal 3 MB.', true); return; } try { heroSlides[Number(input.dataset.heroFile)].image_data = await readImageData(file); setHeroMessage('Gambar diganti. Simpan perubahan untuk menerapkannya.'); renderHeroSlides(); } catch { setHeroMessage('File gambar tidak dapat dibaca.', true); } }));
  list.querySelectorAll('[data-hero-move]').forEach((button) => button.addEventListener('click', () => { const index = Number(button.dataset.heroIndex); const next = button.dataset.heroMove === 'up' ? index - 1 : index + 1; if (next < 0 || next >= heroSlides.length) return; [heroSlides[index], heroSlides[next]] = [heroSlides[next], heroSlides[index]]; renderHeroSlides(); }));
  list.querySelectorAll('[data-hero-remove]').forEach((button) => button.addEventListener('click', () => { heroSlides.splice(Number(button.dataset.heroRemove), 1); renderHeroSlides(); }));
}
async function loadHeroSlides() { try { const result = await api('/api/website/hero-images'); heroSlides = Array.isArray(result.slides) ? result.slides : []; renderHeroSlides(); } catch (error) { $('#heroSlideList').innerHTML = `<div class="empty">${esc(error.message)}</div>`; } }
async function saveHeroSlides() {
  const button = $('#saveHeroSlides'); button.disabled = true; setHeroMessage('Menyimpan gambar hero...');
  try { const response = await fetch('/api/website/hero-images', {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({slides:heroSlides})}); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Perubahan gagal disimpan'); heroSlides = result.slides || []; renderHeroSlides(); setHeroMessage('Perubahan tersimpan. Muat ulang halaman customer untuk melihatnya.', false, true); }
  catch (error) { setHeroMessage(error.message, true); }
  finally { button.disabled = false; }
}
function addHeroImage(file) { if (!file) return; if (heroSlides.length >= maxHeroSlides) { setHeroMessage(`Maksimal ${maxHeroSlides} gambar hero.`, true); return; } if (file.size > maxHeroImageBytes) { setHeroMessage('Ukuran setiap gambar maksimal 3 MB.', true); return; } readImageData(file).then((image_data) => { heroSlides.push({image_data, alt:file.name.replace(/\.[^.]+$/, '').slice(0, 180)}); renderHeroSlides(); setHeroMessage('Gambar ditambahkan. Simpan perubahan untuk menerapkannya.'); }).catch(() => setHeroMessage('File gambar tidak dapat dibaca.', true)); }
let categoryBoxVisualItems = [];
function categoryBoxImageUrl(item) { return item.image_data || `/api/website/category-box-image?path=${encodeURIComponent(item.image || '')}`; }
function setCategoryBoxMessage(slug, message, error = false, success = false) { const node = [...document.querySelectorAll('[data-category-box-message]')].find((item) => item.dataset.categoryBoxMessage === slug); if (!node) return; node.textContent = message; node.className = `category-box-message${error ? ' error' : success ? ' success' : ''}`; }
function renderCategoryBoxVisuals() {
  const list = $('#categoryBoxVisualList'); if (!list) return;
  list.innerHTML = categoryBoxVisualItems.map((item) => `<article class="category-box-visual-card"><div class="category-box-visual-head"><img src="${esc(categoryBoxImageUrl(item))}" alt="Preview ${esc(item.name)}"><div><b>${esc(item.name)}</b><small>Gambar box kategori</small></div></div><label>Ganti gambar<input type="file" accept="image/png,image/jpeg,image/webp" data-category-box-file="${esc(item.slug)}"></label><label class="category-shadow-control"><input type="checkbox" data-category-box-shadow="${esc(item.slug)}" ${item.shadow ? 'checked' : ''}> Efek shadow pada gambar</label><button type="button" class="table-button" data-category-box-save="${esc(item.slug)}">Simpan</button><p class="category-box-message" data-category-box-message="${esc(item.slug)}" role="status"></p></article>`).join('') || '<div class="empty">Belum ada kategori customer.</div>';
  list.querySelectorAll('[data-category-box-file]').forEach((input) => input.addEventListener('change', async () => { const file = input.files?.[0]; if (!file) return; const item = categoryBoxVisualItems.find((row) => row.slug === input.dataset.categoryBoxFile); if (!item) return; if (file.size > maxHeroImageBytes) { setCategoryBoxMessage(item.slug, 'Ukuran gambar maksimal 3 MB.', true); return; } try { item.image_data = await readImageData(file); renderCategoryBoxVisuals(); setCategoryBoxMessage(item.slug, 'Gambar dipilih. Simpan untuk menerapkannya.'); } catch { setCategoryBoxMessage(item.slug, 'File gambar tidak dapat dibaca.', true); } }));
  list.querySelectorAll('[data-category-box-shadow]').forEach((input) => input.addEventListener('change', () => { const item = categoryBoxVisualItems.find((row) => row.slug === input.dataset.categoryBoxShadow); if (item) item.shadow = input.checked; }));
  list.querySelectorAll('[data-category-box-save]').forEach((button) => button.addEventListener('click', () => saveCategoryBoxVisual(button.dataset.categoryBoxSave, button)));
}
async function loadCategoryBoxVisuals() { try { const result = await api('/api/website/category-box-visuals'); categoryBoxVisualItems = Array.isArray(result.items) ? result.items : []; renderCategoryBoxVisuals(); } catch (error) { const list = $('#categoryBoxVisualList'); if (list) list.innerHTML = `<div class="empty">${esc(error.message)}</div>`; } }
async function saveCategoryBoxVisual(slug, button) {
  const item = categoryBoxVisualItems.find((row) => row.slug === slug); if (!item) return;
  button.disabled = true; setCategoryBoxMessage(slug, 'Menyimpan...');
  try { const response = await fetch(`/api/website/category-box-visuals/${encodeURIComponent(slug)}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({image:item.image, image_data:item.image_data || '', shadow:Boolean(item.shadow)})}); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'Pengaturan gambar gagal disimpan.'); Object.assign(item, result, {image_data:''}); renderCategoryBoxVisuals(); setCategoryBoxMessage(slug, 'Tersimpan.', false, true); }
  catch (error) { setCategoryBoxMessage(slug, error.message, true); }
  finally { const current = [...document.querySelectorAll('[data-category-box-save]')].find((node) => node.dataset.categoryBoxSave === slug); if (current) current.disabled = false; }
}

function setupProductAdmin() {
  const create = $('#productCreate');
  const add = $('#addProduct');
  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (!form.matches('.catalog-editor')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const data = new FormData(form);
    try {
      const imageFile = form.querySelector('[name="image_file"]')?.files?.[0];
      if (imageFile) data.set('image_data', await readImageData(imageFile));
      await save(`/api/website/products/${form.dataset.productId}`, {
        name:data.get('name'), category:data.get('category'), product_type:data.get('product_type'),
        kind:data.get('kind'), base_price:Number(data.get('base_price')), unit:data.get('unit'),
        image_path:data.get('image_path') || '', image_data:data.get('image_data') || '',
        description:data.get('description'), sizes:String(data.get('sizes')).split(',').map((v) => v.trim()).filter(Boolean),
        materials:String(data.get('materials') || '').split(',').map((v) => v.trim()).filter(Boolean),
        is_active:data.has('is_active')
      });
      await load();
    } catch (error) { alert(error.message); }
  }, true);
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-product]');
    if (!button) return;
    if (!confirm(`Arsipkan produk ${button.dataset.productName}? Produk tidak tampil lagi di customer.`)) return;
    try { await remove(`/api/website/products/${button.dataset.deleteProduct}`); await load(); }
    catch (error) { alert(error.message); }
  });
  add?.addEventListener('click', () => {
    create.hidden = !create.hidden;
    if (create.hidden) return;
    create.innerHTML = `<form class="product-create-form">
      <div class="field-label">Data produk</div>
      <label>Nama produk<input name="name" required maxlength="120"></label>
      <label>Kategori<select name="category" required>${categoryOptions()}</select></label>
      <label>Label jenis produk<input name="product_type" placeholder="Contoh: Banner / Spanduk" required maxlength="80"><small>Label yang tampil di katalog customer.</small></label>
      <label>Jenis perhitungan<select name="kind" required>
        <option value="custom">Custom</option><option value="banner">Banner (per m³)</option><option value="sticker">Sticker (per lembar)</option>
        <option value="paper">Paper</option><option value="canvas">Canvas</option><option value="card">Card</option><option value="merchandise">Merchandise</option><option value="poster">Poster</option>
      </select><small>Nilai kind yang dipakai aturan harga dan pesanan.</small></label>
      <label>Harga dasar<input name="base_price" type="number" min="0" step="1" required></label>
      <label>Satuan<input name="unit" value="pcs" maxlength="20" required></label>
      <label>Foto produk<input name="image_file" type="file" accept="image/png,image/jpeg,image/webp" required><small>Pilih dari galeri perangkat. PNG, JPG, atau WEBP, maksimal 10 MB.</small></label>
      <div class="product-image-preview"><img data-create-image-preview alt="Preview foto produk" hidden></div>
      <label>Ukuran tersedia<input name="sizes" placeholder="A4, A3, Custom"><small>Pisahkan tiap ukuran dengan koma.</small></label>
      <label>Bahan tersedia (opsional)<input name="materials" placeholder="Flexi China 260, Korea 440"><small>Pisahkan tiap bahan dengan koma.</small></label>
      <label class="full-field">Deskripsi<textarea name="description" rows="3" maxlength="4000"></textarea></label>
      <div class="product-create-actions"><button class="secondary" type="button" data-cancel-create>Batal</button><button class="section-action" type="submit">Simpan produk</button></div>
    </form>`;
    const form = create.querySelector('form');
    const imageInput = form.querySelector('[name="image_file"]');
    imageInput.addEventListener('change', () => {
      const file = imageInput.files?.[0];
      const preview = form.querySelector('[data-create-image-preview]');
      if (!preview) return;
      preview.hidden = !file;
      if (file) preview.src = URL.createObjectURL(file);
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const data = new FormData(form);
        const imageFile = data.get('image_file');
        if (!imageFile?.size) throw new Error('Pilih foto produk terlebih dahulu.');
        if (imageFile.size > 10 * 1024 * 1024) throw new Error('Foto maksimal 10 MB.');
        const response = await fetch('/api/website/products', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            name:data.get('name'), category:data.get('category'), product_type:data.get('product_type'),
            kind:data.get('kind'), base_price:Number(data.get('base_price')), unit:data.get('unit'),
            image_data:await readImageData(imageFile), description:data.get('description'),
            sizes:String(data.get('sizes') || '').split(',').map((v) => v.trim()).filter(Boolean),
            materials:String(data.get('materials') || '').split(',').map((v) => v.trim()).filter(Boolean)
          })
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || 'Produk gagal dibuat');
        create.hidden = true;
        await load();
      } catch (error) { alert(error.message); }
      finally { submit.disabled = false; }
    });
    create.querySelector('[data-cancel-create]').addEventListener('click', () => { create.hidden = true; });
  });
}function renderCatalog(rows) { const target = $('#catalogList'); if (!target) return; target.innerHTML = rows.length ? `<div class="data-table product-list"><div class="data-head"><span>PRODUCT</span><span>CLASSIFICATION</span><span>PRICE</span><span>STATUS</span><span>EDIT</span></div>${rows.map((p) => `<details class="product-record"><summary><span class="product-cell"><strong>${esc(p.name)}</strong><small>${esc(p.slug)}</small></span><span>${esc(p.category)} · ${esc(p.product_type)}</span><span>${money(p.base_price)} / ${esc(p.unit)}</span><span class="record-status ${p.is_active === 0 ? 'off' : 'on'}">${p.is_active === 0 ? 'Draft' : 'Published'}</span><span class="edit-label">Edit <b>⌄</b></span></summary><form class="catalog-editor" data-product-id="${p.id}"><div class="field-label">Product settings</div><label>Name<input name="name" value="${esc(p.name)}" aria-label="Nama produk"></label><label>Category<input name="category" value="${esc(p.category)}" aria-label="Kategori"></label><label>Product type<input name="product_type" value="${esc(p.product_type)}" aria-label="Tipe produk"></label><label>Base price<input name="base_price" type="number" min="0" value="${Number(p.base_price)}" aria-label="Harga dasar"></label><label>Unit<input name="unit" value="${esc(p.unit)}" aria-label="Unit"></label><label>Sizes<input name="sizes" value="${esc((p.sizes || []).join(', '))}" aria-label="Ukuran"></label><label class="active-cell"><input name="is_active" type="checkbox" ${p.is_active === undefined || p.is_active ? 'checked' : ''}> Published</label><button type="submit">Save changes</button></form></details>`).join('')}</div>` : '<div class="empty">Tidak ada produk aktif.</div>'; document.querySelectorAll('.catalog-editor').forEach((form) => form.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(form); try { await save(`/api/website/products/${form.dataset.productId}`, {name:data.get('name'),category:data.get('category'),product_type:data.get('product_type'),base_price:Number(data.get('base_price')),unit:data.get('unit'),sizes:String(data.get('sizes')).split(',').map((v) => v.trim()).filter(Boolean),materials:String(data.get('materials') || '').split(',').map((v) => v.trim()).filter(Boolean),is_active:data.has('is_active')}); await load(); } catch (error) { alert(error.message); } })); }
function enhanceCatalogEditors() { document.querySelectorAll('.catalog-editor').forEach((form) => { if (form.dataset.enhanced) return; form.dataset.enhanced = 'true'; const product = catalogCache.find((item) => String(item.id) === String(form.dataset.productId)) || {}; const submit = form.querySelector('button[type="submit"]'); submit?.insertAdjacentHTML('beforebegin', `<label>Kind<input name="kind" value="${esc(product.kind || 'custom')}"></label><label>Materials (opsional)<input name="materials" value="${esc((product.materials || []).join(', '))}" placeholder="Flexi China 260, Flexi China 330, Korea 440"></label><label>Foto (path/URL)<input name="image_path" value="${esc(product.image_path || '')}"></label><label>Upload foto<input name="image_file" type="file" accept="image/png,image/jpeg,image/webp"></label><div class="product-image-preview"><img data-product-image-preview src="${product.image_path ? `/${esc(product.image_path)}` : ''}" alt="Preview ${esc(product.name || 'produk')}" ${product.image_path ? '' : 'hidden'}></div><label class="full-field">Deskripsi produk<textarea name="description" rows="3">${esc(product.description || '')}</textarea></label><button class="danger-action" type="button" data-delete-product="${product.id}" data-product-name="${esc(product.name || '')}">Delete product</button>`); }); }
document.addEventListener('change', (event) => { const input = event.target; if (!input.matches('.catalog-editor [name="image_file"]')) return; const preview = input.closest('.catalog-editor')?.querySelector('[data-product-image-preview]'); const file = input.files?.[0]; if (!preview || !file) return; preview.src = URL.createObjectURL(file); preview.hidden = false; });
document.addEventListener('input', (event) => { const input = event.target; if (!input.matches('.catalog-editor [name="image_path"]')) return; const preview = input.closest('.catalog-editor')?.querySelector('[data-product-image-preview]'); if (!preview || input.closest('.catalog-editor')?.querySelector('[name="image_file"]')?.files?.length) return; const path = input.value.trim(); preview.src = path ? (path.startsWith('/') ? path : `/${path}`) : ''; preview.hidden = !path; });
function formatTimerDuration(seconds) { const total = Math.max(0, Number(seconds || 0)); const hours = Math.floor(total / 3600); const minutes = Math.floor((total % 3600) / 60); return `${hours} jam${minutes ? ` ${minutes} menit` : ''}`; }
function renderPromoTimer(settings) { const target = $('#promoTimerSettings'); if (!target) return; const mode = settings.mode || 'one_time'; const endAction = settings.end_action || 'hide_box'; const randomMode = mode === 'random_loop'; const loopMode = mode === 'fixed_loop' || randomMode; const ends = settings.ends_at ? new Date(settings.ends_at).toLocaleString('id-ID', {dateStyle:'medium', timeStyle:'short'}) : 'belum dijadwalkan'; target.innerHTML = `<div class="promo-timer-head"><div><span class="eyebrow">GLOBAL PROMO TIMER</span><h4>Atur masa berlaku box promo</h4><p>Timer ini menjadi sumber waktu bersama untuk box promo customer dan status harga promo.</p></div><span class="timer-live-state ${settings.visible ? 'is-live' : 'is-off'}">${settings.visible ? 'LIVE' : 'OFF'}</span></div><form id="promoTimerForm" class="promo-timer-form"><label class="timer-switch"><input name="enabled" type="checkbox" ${settings.enabled ? 'checked' : ''}><span>Aktifkan promo global</span></label><label>Mode timer<select name="mode"><option value="one_time" ${mode === 'one_time' ? 'selected' : ''}>Satu kali, lalu jalankan aksi akhir</option><option value="fixed_loop" ${mode === 'fixed_loop' ? 'selected' : ''}>Loop durasi tetap</option><option value="random_loop" ${mode === 'random_loop' ? 'selected' : ''}>Loop durasi random</option></select></label><label>Durasi awal / loop (jam)<input name="duration_hours" type="number" min="0.02" step="0.25" value="${(Number(settings.duration_seconds || 28800) / 3600).toFixed(2)}"></label><label class="loop-field" ${loopMode ? '' : 'hidden'}>Reset saat tersisa (jam)<input name="reset_threshold_hours" type="number" min="0" step="0.25" value="${(Number(settings.reset_threshold_seconds || 14400) / 3600).toFixed(2)}"></label><div class="random-fields" ${randomMode ? '' : 'hidden'}><label>Random minimum (jam)<input name="random_min_hours" type="number" min="0.02" step="0.25" value="${(Number(settings.random_min_seconds || 14400) / 3600).toFixed(2)}"></label><label>Random maksimum (jam)<input name="random_max_hours" type="number" min="0.02" step="0.25" value="${(Number(settings.random_max_seconds || 43200) / 3600).toFixed(2)}"></label></div><label>Aksi saat timer selesai<select name="end_action"><option value="reset_timer" ${endAction === 'reset_timer' ? 'selected' : ''}>Reset timer ke durasi baru</option><option value="hide_box" ${endAction === 'hide_box' ? 'selected' : ''}>Sembunyikan box promo dan matikan harga promo</option><option value="deactivate_promos" ${endAction === 'deactivate_promos' ? 'selected' : ''}>Matikan semua promo dan sembunyikan box</option></select></label><label class="timer-check"><input name="restart_cycle" type="checkbox"> Mulai cycle baru sekarang</label><label class="timer-check"><input name="reactivate_promos" type="checkbox"> Aktifkan kembali semua promo yang tersimpan</label><button class="section-action" type="submit">Simpan pengaturan timer</button></form><div class="promo-timer-status"><strong>Cycle aktif</strong><span>Reset berikutnya: ${esc(ends)}</span><span>Durasi random yang tergenerate: ${formatTimerDuration(settings.generated_duration_seconds || settings.duration_seconds)}</span></div>`; const form = $('#promoTimerForm'); const modeInput = form?.querySelector('[name="mode"]'); const syncMode = () => { const value = modeInput?.value; const loop = value === 'fixed_loop' || value === 'random_loop'; const random = value === 'random_loop'; form?.querySelector('.loop-field')?.toggleAttribute('hidden', !loop); form?.querySelector('.random-fields')?.toggleAttribute('hidden', !random); }; modeInput?.addEventListener('change', syncMode); form?.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(form); try { await save('/api/website/promo-settings', {enabled:data.has('enabled'), mode:data.get('mode'), duration_seconds:Number(data.get('duration_hours')) * 3600, reset_threshold_seconds:Number(data.get('reset_threshold_hours') || 0) * 3600, random_min_seconds:Number(data.get('random_min_hours') || 1) * 3600, random_max_seconds:Number(data.get('random_max_hours') || 1) * 3600, end_action:data.get('end_action'), restart_cycle:data.has('restart_cycle'), reactivate_promos:data.has('reactivate_promos')}); await load(); alert('Pengaturan timer promo tersimpan.'); } catch (error) { alert(error.message); } }); }
function renderPromos(rows) { const target = $('#promoList'); if (!target) return; target.innerHTML = rows.length ? `<div class="data-table promo-table"><div class="data-head"><span>PRODUCT</span><span>CAMPAIGN</span><span>PRICE</span><span>VALIDITY</span><span>ACTION</span></div>${rows.map((p) => `<details class="promo-record"><summary><strong>${esc(p.name)}</strong><span>${esc(p.promo_title || 'No campaign')}</span><span>${p.promo_id ? `${money(p.promo_price)} · -${Number(p.discount_percent || 0)}%` : 'Not configured'}</span><span class="record-status ${p.promo_id ? 'on' : 'off'}">${p.promo_id ? 'Configured' : 'Off'}</span><span class="edit-label">Edit <b>⌄</b></span></summary><form class="promo-item promo-editor" data-product-id="${p.id}" data-base-price="${Number(p.base_price || 0)}"><div class="field-label">Campaign settings · ${esc(p.name)}</div><label>Title<input name="title" value="${esc(p.promo_title || 'Promo katalog')}" placeholder="Campaign title"></label><label>Discount %<input class="promo-discount" name="discount_percent" type="number" min="0" max="100" step="0.01" value="${Number(p.discount_percent || 0)}"></label><label>Calculated price<output class="promo-calculated-price">${money(p.promo_price || p.base_price)}</output></label><label>Starts at<input name="starts_at" type="datetime-local" value="${esc(String(p.promo_starts_at || '').replace(' ','T').slice(0,16))}"></label><label>Ends at<input name="ends_at" type="datetime-local" value="${esc(String(p.promo_ends_at || '').replace(' ','T').slice(0,16))}"></label><label class="active-cell"><input name="is_active" type="checkbox" ${p.promo_id && (p.is_active === undefined || p.is_active) ? 'checked' : ''}> Live</label><button type="submit">Save campaign</button></form></details>`).join('')}</div>` : '<div class="empty">Tidak ada produk di katalog.</div>'; document.querySelectorAll('.promo-editor').forEach((form) => { form.querySelector('.promo-discount')?.addEventListener('input', (event) => { const price = Number(form.dataset.basePrice || 0) * (1 - Math.max(0, Math.min(100, Number(event.target.value || 0))) / 100); const calculated = form.querySelector('.promo-calculated-price'); if (calculated) calculated.textContent = money(price); }); form.addEventListener('submit', async (event) => { event.preventDefault(); const data = new FormData(form); try { await save(`/api/website/promotions/${form.dataset.productId}`, {title:data.get('title'),discount_percent:Number(data.get('discount_percent')),starts_at:data.get('starts_at'),ends_at:data.get('ends_at'),is_active:data.has('is_active')}); await load(); } catch (error) { alert(error.message); } }); }); }
function renderOrders(rows) { $('#orderList').innerHTML = rows.length ? rows.slice(0,12).map((o) => `<div class="admin-row"><strong>${esc(o.order_number)}</strong><small>${esc(o.customer_name || 'Guest')}</small><span>${money(o.grand_total)}</span><span class="status status-${esc(o.status)}">${esc(o.status)}</span></div>`).join('') : '<div class="empty">Belum ada order.</div>'; }
async function loadSessions() { const target = $('#sessionList'); if (!target) return; const rows = await api('/api/website/chat-sessions'); target.innerHTML = rows.length ? rows.map((s) => `<div class="session-item" data-session="${esc(s.session_id)}"><strong>${esc(s.session_id.slice(0,18))}…</strong><small>${esc(s.message_count)} pesan · ${esc(s.latest_message || '')}</small></div>`).join('') : '<div class="empty">Belum ada sesi chat.</div>'; document.querySelectorAll('[data-session]').forEach((node) => node.addEventListener('click', async () => { const messages = await api(`/api/website/chat-sessions/${encodeURIComponent(node.dataset.session)}`); const detail = $('#sessionMessages'); if (detail) detail.textContent = messages.map((m) => `[${m.role}] ${m.message}`).join('\n\n'); })); }
async function load() {
  const [healthResult, catalogResult, ordersResult, timerResult] = await Promise.allSettled([api('/api/website/health'), api('/api/website/admin-catalog'), api('/api/website/orders'), api('/api/website/promo-settings')]);
  if (healthResult.status === 'fulfilled') { const health = healthResult.value; $('#health').textContent = `${health.database_configured ? '● MySQL tersambung' : '○ MySQL belum tersambung'} · ${health.catalog_count} produk aktif`; }
  else $('#health').textContent = healthResult.reason.message;
  if (catalogResult.status === 'fulfilled') { const catalog = catalogResult.value; const promoCount = catalog.filter((item) => item.promo_id && item.promo_ends_at && new Date(item.promo_ends_at).getTime() >= Date.now()).length; $('#productStat').textContent = catalog.filter((item) => item.is_active === undefined || item.is_active).length; $('#promoStat').textContent = promoCount; renderCatalog(catalog); renderPromos(catalog); }
  else { $('#catalogList').innerHTML = `<div class="empty">${esc(catalogResult.reason.message)}</div>`; $('#promoList').innerHTML = '<div class="empty">Katalog promo belum dapat dimuat.</div>'; }
  if (ordersResult.status === 'fulfilled') { $('#orderStat').textContent = ordersResult.value.length; renderOrders(ordersResult.value); }
  else { $('#orderList').innerHTML = `<div class="empty">${esc(ordersResult.reason.message)}</div>`; }
  if (timerResult.status === 'fulfilled') renderPromoTimer(timerResult.value);
  else if ($('#promoTimerSettings')) $('#promoTimerSettings').innerHTML = `<div class="empty">${esc(timerResult.reason.message)}</div>`;
  try { await loadSessions(); if ($('#chatStat')) $('#chatStat').textContent = document.querySelectorAll('[data-session]').length; } catch (error) { if ($('#chatStat')) $('#chatStat').textContent = '—'; const sessionList = $('#sessionList'); if (sessionList) sessionList.innerHTML = `<div class="empty">${esc(error.message)}</div>`; }
}
setupProductAdmin();
$('#addHeroSlide')?.addEventListener('click', () => $('#heroImagePicker')?.click());
$('#heroImagePicker')?.addEventListener('change', (event) => { addHeroImage(event.currentTarget.files?.[0]); event.currentTarget.value = ''; });
$('#saveHeroSlides')?.addEventListener('click', saveHeroSlides);
loadHeroSlides();
loadCategoryBoxVisuals();
new MutationObserver(() => { enhanceCatalogEditors(); applyCategorySelects(); }).observe($('#catalogList'), {childList:true, subtree:true});
api('/api/website/admin-catalog').then((rows) => { catalogCache = rows; enhanceCatalogEditors(); }).catch(() => {});
loadCategories(); $('#refreshCatalog').addEventListener('click', load); load();
function productImagePreviewUrl(path) { return path ? '/api/website/product-image?path=' + encodeURIComponent(path) : ''; }
new MutationObserver(() => { document.querySelectorAll('.catalog-editor').forEach((form) => { const input = form.querySelector('[name="image_path"]'); const preview = form.querySelector('[data-product-image-preview]'); if (input && preview && !form.querySelector('[name="image_file"]')?.files?.length && input.value.trim()) { preview.src = productImagePreviewUrl(input.value.trim()); preview.hidden = false; } }); }).observe(document.querySelector('#catalogList'), {childList:true, subtree:true});
function syncDashboardProductPreviews() { document.querySelectorAll('.catalog-editor').forEach((form) => { const input = form.querySelector('[name="image_path"]'); const preview = form.querySelector('[data-product-image-preview]'); if (!input || !preview || form.querySelector('[name="image_file"]')?.files?.length) return; const path = input.value.trim(); if (!path) { preview.hidden = true; return; } const expected = productImagePreviewUrl(path); if (preview.src !== new URL(expected, window.location.href).href) preview.src = expected; preview.hidden = false; }); }
syncDashboardProductPreviews();
new MutationObserver(syncDashboardProductPreviews).observe(document.querySelector('#catalogList'), {childList:true, subtree:true});
