(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = (value) => `Rp ${Math.round(Number(value) || 0).toLocaleString('id-ID')}`;
  const areaProduct = (product) => /^m(?:2|\^2)$/i.test(String(product.unit||'')) || (String(product.unit||'').toLowerCase().startsWith('m')&&String(product.unit||'').charCodeAt(1)===178);
  let products = [];
  let materials = [];
  let cart = [];
  let category = 'Semua';
  let query = '';
  let visibleProducts = 5;
  let catalogPicker;
  let catalogReturnFocus;
  let materialPicker;
  let materialPickerReturnFocus;

  function closeCatalogPicker(restoreFocus = true) {
    if (!catalogPicker) return;
    catalogPicker.hidden = true;
    document.body.classList.remove('cashier-catalog-open');
    if (restoreFocus) catalogReturnFocus?.focus?.();
    catalogReturnFocus = null;
  }
  function openCatalogPicker() {
    if (!catalogPicker) return;
    catalogReturnFocus = document.activeElement;
    catalogPicker.hidden = false;
    document.body.classList.add('cashier-catalog-open');
    $('#productSearch').focus();
  }
  function setupCatalogPicker() {
    const panel = $('.catalog-panel');
    $('.sale-layout').classList.add('is-cart-only');
    const dialog = document.createElement('section');
    catalogPicker = document.createElement('div');
    catalogPicker.className = 'cashier-catalog-backdrop';
    catalogPicker.hidden = true;
    dialog.className = 'cashier-catalog-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'cashierCatalogTitle');
    const dialogHead = document.createElement('div');
    dialogHead.className = 'cashier-catalog-dialog-head';
    const closeButton = document.createElement('button');
    closeButton.type = 'button'; closeButton.className = 'cashier-catalog-close';
    closeButton.setAttribute('aria-label', 'Tutup katalog');
    closeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
    panel.querySelector('.panel-toolbar h2').id = 'cashierCatalogTitle';
    dialogHead.append(closeButton); dialog.append(dialogHead, panel); catalogPicker.append(dialog); document.body.append(catalogPicker);
    closeButton.addEventListener('click', closeCatalogPicker);
    catalogPicker.addEventListener('click', (event) => { if (event.target === catalogPicker) closeCatalogPicker(); });
    $('#cartAddProduct')?.addEventListener('click', openCatalogPicker);
    $('#cartPanel .cart-heading h2')?.setAttribute('tabindex', '-1');
    $('#cartItems').addEventListener('click', (event) => { if (event.target.closest('.cart-empty-trigger')) openCatalogPicker(); });
    $('#cartItems').addEventListener('keydown', (event) => {
      if (event.target.closest('.cart-empty-trigger') && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openCatalogPicker(); }
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !catalogPicker.hidden) closeCatalogPicker(); });
  }

  function setupDesignMaterialField() {
    const customerBox = $('.customer-box');
    if (!customerBox || $('#cashierDesignMaterial')) return;
    customerBox.insertAdjacentHTML('afterend', `<section class="cashier-parent-material"><div class="cashier-parent-material-heading"><span>Material untuk desain <b>Wajib</b></span><small id="cashierDesignMaterialHelp">Pilih material aktif dari tabel material. Pilihan ini dicatat pada nota.</small></div><input id="cashierDesignMaterial" type="hidden" required><div class="cashier-parent-material-selection"><div id="cashierDesignMaterialSummary" class="cashier-parent-material-summary" aria-live="polite">Belum ada material dipilih</div><button id="cashierChooseMaterial" type="button" class="cashier-material-trigger" aria-haspopup="dialog">Pilih material</button></div></section>`);
    setupDesignMaterialPicker();
  }

  function closeMaterialPicker(restoreFocus = true) {
    if (!materialPicker) return;
    materialPicker.hidden = true;
    document.body.classList.remove('cashier-catalog-open');
    if (restoreFocus) materialPickerReturnFocus?.focus?.();
    materialPickerReturnFocus = null;
  }

  function openMaterialPicker() {
    if (!materialPicker) return;
    materialPickerReturnFocus = document.activeElement;
    materialPicker.hidden = false;
    document.body.classList.add('cashier-catalog-open');
    $('#cashierMaterialSearch').focus();
    renderMaterialChoices('');
  }

  function renderMaterialChoices(search) {
    const list = $('#cashierMaterialChoices');
    if (!list) return;
    const needle = String(search || '').trim().toLocaleLowerCase('id-ID');
    const matches = materials.filter((material) => `${material.name || ''} ${material.code || ''}`.toLocaleLowerCase('id-ID').includes(needle));
    list.innerHTML = matches.length ? matches.map((material) => `<button type="button" class="cashier-material-option" data-material-id="${Number(material.id)}"><span class="cashier-material-option-copy"><b>${esc(material.name)}</b><small>${esc(material.code || 'Tanpa kode')} · Stok ${Number(material.stock || 0).toLocaleString('id-ID')} ${esc(material.unit || '')}</small></span><strong>Pilih</strong></button>`).join('') : '<p class="cashier-material-empty">Material tidak ditemukan.</p>';
  }

  function setupDesignMaterialPicker() {
    materialPicker = document.createElement('div');
    materialPicker.className = 'cashier-catalog-backdrop';
    materialPicker.hidden = true;
    const dialog = document.createElement('section');
    dialog.className = 'cashier-catalog-dialog cashier-material-dialog';
    dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-labelledby', 'cashierMaterialTitle');
    dialog.innerHTML = `<div class="cashier-catalog-dialog-head"><h2 id="cashierMaterialTitle">Pilih material untuk desain</h2><button type="button" class="cashier-catalog-close" aria-label="Tutup pemilih material"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"></path></svg></button></div><p class="cashier-material-dialog-note">${materials.length.toLocaleString('id-ID')} material aktif</p><input id="cashierMaterialSearch" class="cashier-search" type="search" placeholder="Cari nama atau kode material" autocomplete="off"><div id="cashierMaterialChoices" class="cashier-material-choices"></div>`;
    materialPicker.append(dialog); document.body.append(materialPicker);
    dialog.querySelector('.cashier-catalog-close').addEventListener('click', () => closeMaterialPicker());
    materialPicker.addEventListener('click', (event) => { if (event.target === materialPicker) closeMaterialPicker(); });
    $('#cashierChooseMaterial').addEventListener('click', openMaterialPicker);
    $('#cashierMaterialSearch').addEventListener('input', (event) => renderMaterialChoices(event.target.value));
    $('#cashierMaterialChoices').addEventListener('click', (event) => {
      const choice = event.target.closest('[data-material-id]');
      if (!choice) return;
      const selected = materials.find((material) => Number(material.id) === Number(choice.dataset.materialId));
      if (!selected) return;
      $('#cashierDesignMaterial').value = String(selected.id);
      $('#cashierDesignMaterialSummary').innerHTML = `<b>${esc(selected.name)}</b><small>${esc(selected.code || 'Tanpa kode')} · Stok ${Number(selected.stock || 0).toLocaleString('id-ID')} ${esc(selected.unit || '')}</small>`;
      $('#cashierChooseMaterial').textContent = 'Ganti material';
      renderCart(); closeMaterialPicker();
    });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !materialPicker.hidden) closeMaterialPicker(); });
  }

  function toast(message) {
    const node = $('#cashierToast'); if (!node) return;
    node.textContent = message; node.classList.add('show');
    setTimeout(() => node.classList.remove('show'), 2600);
  }
  function displayUnit(unit) { const value=String(unit||'pcs'); return value.toLowerCase().startsWith('m')&&value.charCodeAt(1)===194 ? `m${String.fromCharCode(178)}` : value; }
  function priceFor(item) { return Number(item.product.base_price) * (item.area_m2 || 1) * Number(item.quantity); }
  function addProduct(product) {
    if (!(Number(product.base_price) > 0)) { toast('Atur harga dasar produk di Metadata sebelum transaksi.'); return; }
    openProductDialog(product);
  }
  function openProductDialog(product) {
    const modal = $('#cashierActionModal'); const form = $('#cashierActionForm'); const content = $('#cashierActionContent'); const error = $('#cashierActionError');
    const isArea = areaProduct(product);
    const presets = [...new Set((product.sizes || []).filter((value) => String(value).toLowerCase() !== 'custom'))];
    const parsePreset = (value) => String(value || '').match(/^(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?$/i);
    const selectedSize = isArea && (product.sizes || []).find((size) => parsePreset(size));
    content.innerHTML = `<p class="eyebrow">KATALOG / SPESIFIKASI</p><h2 id="cashierProductDialogTitle">${esc(product.name)}</h2><p class="cashier-product-dialog-note">${money(product.base_price)} / ${esc(isArea ? `m${String.fromCharCode(178)}` : displayUnit(product.unit))}${isArea ? ' · harga dihitung dari luas dalam m²' : ''}</p>${isArea ? `<label>Ukuran tersedia<select name="preset"><option value="">Ukuran manual</option>${(product.sizes || []).filter((size) => String(size).toLowerCase() !== 'custom').map((size) => `<option value="${esc(size)}" ${size === selectedSize ? 'selected' : ''}>${esc(size)}</option>`).join('')}</select></label><div class="cashier-dimension-fields"><label>Panjang (P)<input name="width" type="number" min="0.001" step="any" value="${esc(parsePreset(selectedSize)?.[1]?.replace(',', '.') || '')}" required></label><label>Lebar (L)<input name="height" type="number" min="0.001" step="any" value="${esc(parsePreset(selectedSize)?.[2]?.replace(',', '.') || '')}" required></label><label>Satuan ukuran<select name="dimension_unit">${['mm','cm','m'].map((unit) => `<option value="${unit}" ${unit === (parsePreset(selectedSize)?.[3] || 'cm').toLowerCase() ? 'selected' : ''}>${unit}</option>`).join('')}</select></label></div><label>Nama file/gambar <input name="file_name" maxlength="255" placeholder="Nama file yang dikirim customer"></label><label>Catatan spesifikasi <input name="specification" maxlength="500" placeholder="Bahan, finishing, atau catatan"></label>` : `<label>Jumlah<input name="quantity" type="number" min="1" step="1" value="1" required></label>${presets.length ? `<label>Pilih ukuran atau bahan<select name="preset"><option value="">Pilih dari Metadata…</option>${presets.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('')}</select></label>` : ''}<label>Nama file/gambar <input name="file_name" maxlength="255" placeholder="Nama file yang dikirim customer"></label><label>Catatan tambahan<textarea name="specification" rows="3" maxlength="500" placeholder="Bahan, ukuran, atau catatan tambahan"></textarea></label>`}<div class="cashier-product-dialog-actions"><button type="button" class="cashier-inline-button" data-close-action>Batal</button><button class="primary-button" type="submit">Tambahkan ke nota</button></div>`;
    const dialogEyebrow = content.querySelector('.eyebrow');
    if (dialogEyebrow) dialogEyebrow.textContent = 'KATALOG / PRODUK';
    const productSizeLabel = content.querySelector('select[name="preset"]')?.closest('label');
    if (productSizeLabel?.firstChild?.nodeType === Node.TEXT_NODE) productSizeLabel.firstChild.textContent = 'Ukuran produk';
    const sizePlaceholder = content.querySelector('select[name="preset"] option[value=""]');
    if (sizePlaceholder) sizePlaceholder.textContent = 'Pilih ukuran (opsional)';
    const previouslyFocused = document.activeElement;
    error.textContent = ''; modal.hidden = false;
    const closeDialog = () => {
      modal.hidden = true;
      form.onsubmit = null;
      const addProductButton = $('#cartAddProduct');
      const focusTarget = addProductButton && !addProductButton.hidden ? addProductButton : previouslyFocused;
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
    };
    form.querySelectorAll('[data-close-action]').forEach((button) => {
      button.onclick = (event) => { event.preventDefault(); closeDialog(); };
    });
    modal.onclick = (event) => { if (event.target === modal) closeDialog(); };
    const firstControl = form.querySelector('input,select,textarea');
    firstControl?.focus();
    const presetSelect = form.elements.preset;
    if (presetSelect) presetSelect.addEventListener('change', () => {
      if (!isArea) { if (presetSelect.value) form.elements.specification.value = presetSelect.value; return; }
      const match = parsePreset(presetSelect.value); if (!match) return;
      form.elements.width.value = match[1].replace(',', '.'); form.elements.height.value = match[2].replace(',', '.');
      form.elements.dimension_unit.value = (match[3] || 'cm').toLowerCase();
    });
    form.onsubmit = (event) => {
      event.preventDefault(); error.textContent = '';
      const fileNote=form.elements.file_name?.value.trim()?`File: ${form.elements.file_name.value.trim()}`:'';
      const itemNote=[form.elements.specification?.value.trim(),fileNote].filter(Boolean).join(' / ');
      let spec = {};
      if (isArea) {
        const width = Number(String(form.elements.width.value).replace(',', '.')); const height = Number(String(form.elements.height.value).replace(',', '.'));
        const unit = form.elements.dimension_unit.value; const factor = {mm:0.001,cm:0.01,m:1}[unit]; const area = width * height * factor * factor;
        if (!Number.isFinite(area) || area <= 0 || area > 100000) { error.textContent = 'Ukuran produk tidak valid atau di luar batas.'; return; }
        spec = {width, height, dimension_unit:unit, area_m2:area, specification:itemNote};
      } else {
        const quantity = Number(form.elements.quantity.value);
        if (!Number.isInteger(quantity) || quantity < 1) { error.textContent = 'Jumlah harus bilangan bulat minimal 1.'; return; }
        spec = {quantity, specification:itemNote};
      }
    const key = `${product.id}:${spec.width || ''}:${spec.height || ''}:${spec.dimension_unit || ''}:${spec.specification || ''}`;
    const existing = cart.find((item) => item.key === key);
    if (existing) existing.quantity += spec.quantity || 1;
    else cart.push({key, product, quantity:spec.quantity || 1, ...spec});
    renderCart();
      closeDialog();
    };
  }
  function renderProducts() {
    const cats = ['Semua', ...new Set(products.map((product) => product.category).filter(Boolean))];
    $('#categoryTabs').innerHTML = cats.map((name) => `<button class="category-tab${category === name ? ' active' : ''}" type="button" data-cashier-category="${esc(name)}">${esc(name)} <small>${name === 'Semua' ? products.length : products.filter((product) => product.category === name).length}</small></button>`).join('');
    $('#categoryTabs').querySelectorAll('[data-cashier-category]').forEach((button) => button.addEventListener('click', () => { category = button.dataset.cashierCategory; visibleProducts = 5; renderProducts(); }));
    const filtered = products.filter((product) => (category === 'Semua' || product.category === category) && (!query || `${product.name} ${product.category} ${product.product_type}`.toLowerCase().includes(query.toLowerCase())));
    const shown = filtered.slice(0, visibleProducts);
    $('#productGrid').innerHTML = (shown.map((product) => `<button class="product-tile" type="button" data-add-product="${product.id}" aria-label="Tambah ${esc(product.name)}" ${Number(product.base_price) <= 0 ? 'disabled' : ''}><span class="product-tile-icon" aria-hidden="true">&#9633;</span><span class="product-tile-copy"><b>${esc(product.name)}</b><small>${esc(product.category || 'Produk')}</small><strong>${money(product.base_price)} <small>/ ${esc(displayUnit(product.unit))}${Number(product.base_price) <= 0 ? ' &middot; harga belum diatur' : ''}</small></strong></span><span class="product-add"><span aria-hidden="true">+</span> Tambah</span></button>`).join('') || '<div class="no-results">Produk tidak ditemukan.</div>') + (filtered.length > shown.length ? `<button class="cashier-load-more" id="loadMoreProducts" type="button">Muat lebih banyak (${filtered.length - shown.length} tersisa)</button>` : '');
    $('#productGrid').querySelectorAll('.product-tile-icon').forEach((icon) => icon.remove());
    $('#productGrid').querySelectorAll('.product-add').forEach((action) => { action.textContent = 'Pilih produk'; });
    $('#productGrid').querySelectorAll('[data-add-product]').forEach((button) => button.setAttribute('aria-label', `Pilih ${products.find((product) => product.id === Number(button.dataset.addProduct))?.name || 'produk'}`));
    $('#productGrid').querySelectorAll('[data-add-product]').forEach((button) => button.addEventListener('click', () => { const product = products.find((item) => item.id === Number(button.dataset.addProduct)); closeCatalogPicker(false); const addButton = $('#cartAddProduct'); (addButton && !addButton.hidden ? addButton : $('#cartPanel .cart-heading h2'))?.focus(); addProduct(product); }));
    $('#loadMoreProducts')?.addEventListener('click', () => { visibleProducts += 5; renderProducts(); });
  }
  function renderCart() {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    $('#cartCount').textContent = `${count} item`;
    const addProductButton = $('#cartAddProduct');
    if (addProductButton) addProductButton.hidden = cart.length === 0;
    $('#cartItems').innerHTML = cart.length ? cart.map((item, index) => `<article class="cart-line"><span class="line-icon" aria-hidden="true">▱</span><div class="cart-line-info"><b>${esc(item.product.name)}</b><small class="cashier-cart-spec">${esc(item.specification || (item.width ? `${item.width} × ${item.height} ${item.dimension_unit}` : item.product.unit))}</small><div class="qty-control"><button type="button" data-qty="${index}" data-step="-1" aria-label="Kurangi ${esc(item.product.name)}">−</button><span>${item.quantity}</span><button type="button" data-qty="${index}" data-step="1" aria-label="Tambah ${esc(item.product.name)}">＋</button></div></div><div class="line-price"><small>${money(item.product.base_price)} / ${esc(item.product.unit)}</small><strong>${money(priceFor(item))}</strong></div><button class="remove-line" type="button" data-remove="${index}" aria-label="Hapus ${esc(item.product.name)}">×</button></article>`).join('') : '<div class="cart-empty cart-empty-trigger" role="button" tabindex="0" aria-label="Buka katalog produk"><span>+</span><b>Keranjang masih kosong</b><small>Pilih produk dari katalog untuk memulai.</small></div>';
    $('#cartItems').querySelectorAll('[data-qty]').forEach((button) => button.addEventListener('click', () => { const item = cart[Number(button.dataset.qty)]; item.quantity += Number(button.dataset.step); if (item.quantity <= 0) cart.splice(Number(button.dataset.qty), 1); renderCart(); }));
    $('#cartItems').querySelectorAll('[data-remove]').forEach((button) => button.addEventListener('click', () => { cart.splice(Number(button.dataset.remove), 1); renderCart(); }));
    const total = cart.reduce((sum, item) => sum + priceFor(item), 0);
    $('#subtotal').textContent = money(total); $('#grandTotal').textContent = money(total);
    if ($('#mobileGrandTotal')) $('#mobileGrandTotal').textContent = money(total);
    const method = $('#paymentMethod').value; const rawAmount = $('#paymentAmount').value.trim();
    const amount = rawAmount === '' ? 0 : Number(rawAmount);
    const paid = Math.min(amount, total); const residual = Math.max(0, total - paid); const change = method === 'cash' ? Math.max(0, amount - total) : 0;
    $('#paymentAmountLabel').textContent = method === 'cash' ? 'Jumlah diterima' : 'Jumlah pembayaran';
    const unpaid = $('#saveUnpaid').checked;
    $('#dueLabel').textContent = unpaid ? 'Belum dibayar' : change ? 'Kembalian tunai' : 'Sisa tagihan';
    $('#duePreview').textContent = unpaid ? money(total) : change ? money(change) : money(residual);
    $('#paySale').innerHTML = unpaid ? 'Simpan nota belum dibayar' : 'Simpan transaksi <b>&rarr;</b>';
    $('#paymentAmount').placeholder = `Tagihan ${money(total)}`;
    const invalidAmount = !unpaid && (rawAmount !== '' && (!Number.isFinite(amount) || amount < 0) || amount <= 0);
    const nonCashExcess = !unpaid && method !== 'cash' && amount > total;
    const missingDesignMaterial = !$('#cashierDesignMaterial')?.value;
    const submit = $('#paySale');
    submit.disabled = total <= 0 || invalidAmount || nonCashExcess || missingDesignMaterial;
    const message = $('#cashierMessage');
    if (cart.length && total <= 0) message.textContent = 'Total transaksi harus lebih dari Rp 0.';
    else if (cart.length && missingDesignMaterial) message.textContent = 'Pilih material untuk desain sebelum menyimpan transaksi.';
    else if (invalidAmount) message.textContent = rawAmount === '' ? 'Isi pembayaran atau pilih simpan tanpa pembayaran.' : 'Pembayaran tidak boleh negatif dan harus lebih dari Rp 0.';
    else if (nonCashExcess) message.textContent = `Pembayaran ${method.toUpperCase()} melebihi sisa tagihan ${money(total)}.`;
    else if (message.dataset.validation === 'true') message.textContent = '';
    message.dataset.validation = (cart.length && (total <= 0 || missingDesignMaterial)) || invalidAmount || nonCashExcess ? 'true' : 'false';
  }
  function dateLabel(value) { const d = new Date(String(value).replace(' ', 'T') + (String(value).endsWith('Z') ? '' : 'Z')); return Number.isNaN(d.getTime()) ? String(value || '') : new Intl.DateTimeFormat('id-ID', {dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(d); }
  function renderReceipt(sale) {
    const payments = sale.payments || [];
    const remaining = Math.max(0, Number(sale.total) - Number(sale.amount_paid));
    $('#receiptContent').innerHTML = `<div class="receipt-brand"><img class="receipt-logo" src="assets/branding/fazima-print-logo.png" alt="Fazima Print"><small>Digital Printing & Advertising</small></div><h2 id="receiptTitle">Nota ${esc(sale.invoice_number)}</h2><p>${esc(dateLabel(sale.created_at))}<br>Kasir: ${esc(sale.cashier_name)}${sale.customer_name ? `<br>Customer: ${esc(sale.customer_name)}` : ''}</p><div class="cashier-receipt-items">${(sale.items || []).map((item) => `<div class="cashier-receipt-row"><span>${esc(item.product_name)} × ${Number(item.quantity)}<small>${esc(item.specification || 'Tanpa spesifikasi')} · ${money(item.unit_price)} / ${esc(item.unit)}</small></span><b>${money(item.line_total)}</b></div>`).join('')}</div><hr><div class="cashier-receipt-row"><span>Subtotal / total</span><b>${money(sale.total)}</b></div><h3>Pembayaran</h3><div class="cashier-payment-history">${payments.map((payment) => `<div class="cashier-payment-row"><span>${esc(payment.method.toUpperCase())} · ${esc(dateLabel(payment.created_at))}<small>Diproses ${esc(payment.processed_by_name || sale.cashier_name)} · Diterima ${money(payment.tendered_amount)}${Number(payment.change_amount) ? ` · Kembalian ${money(payment.change_amount)}` : ''}</small></span><b>${money(payment.amount_applied)}</b></div>`).join('') || '<small>Belum ada pembayaran.</small>'}</div><div class="cashier-receipt-row"><span>Status</span><b>${sale.status === 'paid' ? 'LUNAS' : sale.status === 'partial' ? 'DP / SEBAGIAN' : sale.status === 'void' ? 'DIBATALKAN' : 'BELUM DIBAYAR'}</b></div><div class="cashier-receipt-row"><span>Sisa tagihan</span><b>${money(remaining)}</b></div>${sale.status === 'void' ? `<p>Alasan batal: ${esc(sale.void_reason)}</p>` : ''}<details class="cashier-audit-details"><summary>Aktivitas nota (${(sale.audit || []).length})</summary>${(sale.audit || []).map((entry) => `<p><b>${esc(entry.action)}</b> · ${esc(dateLabel(entry.created_at))}<br>${esc(entry.actor_name)}${entry.reason ? ` · ${esc(entry.reason)}` : ''}</p>`).join('') || '<small>Belum ada aktivitas.</small>'}</details><p class="receipt-thanks">Terima kasih telah mempercayakan kebutuhan cetak Anda kepada Fazima Print.</p>`;
    $('#receiptModal').hidden = false; window.currentCashierSale = sale;
  }
  async function refreshStats() {
    const sales = await window.cashierApi('/api/cashier/sales');
    const now = new Date(); const today = sales.filter((sale) => { const date = new Date(String(sale.created_at).replace(' ', 'T') + 'Z'); return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate() && sale.status !== 'void'; });
    $('#todaySalesCount').textContent = String(today.length); $('#todaySalesTotal').textContent = money(today.reduce((sum, sale) => sum + Number(sale.amount_paid), 0)) + ' diterima';
    $('#unpaidSalesCount').textContent = String(sales.filter((sale) => ['unpaid','partial'].includes(sale.status)).length);
  }
  function bindSale() {
    $('#productSearch').addEventListener('input', (event) => { query = event.target.value; visibleProducts = 5; renderProducts(); });
    $('#paymentAmount').addEventListener('input', renderCart); $('#paymentMethod').addEventListener('change', renderCart);
    $('#saveUnpaid').addEventListener('change', () => {
      const unpaid = $('#saveUnpaid').checked;
      $('#paymentAmount').disabled = unpaid; $('#paymentMethod').disabled = unpaid;
      if (unpaid) $('#paymentAmount').value = '';
      renderCart();
    });
    $('#paySale').addEventListener('click', async () => {
      const message = $('#cashierMessage'); message.textContent = '';
      if (!cart.length) { message.textContent = 'Tambahkan minimal satu produk.'; return; }
      const designMaterialId = Number($('#cashierDesignMaterial').value);
      if (!Number.isInteger(designMaterialId) || designMaterialId <= 0) { message.textContent = 'Pilih material untuk desain sebelum menyimpan transaksi.'; $('#cashierChooseMaterial').focus(); return; }
      const total = cart.reduce((sum, item) => sum + priceFor(item), 0);
      if (!Number.isFinite(total) || total <= 0) { message.textContent = 'Total transaksi harus lebih dari Rp 0.'; return; }
      const rawAmount = $('#paymentAmount').value.trim();
      const paymentAmount = rawAmount === '' ? 0 : Number(rawAmount);
      const method = $('#paymentMethod').value;
      if (!$('#saveUnpaid').checked && (!Number.isFinite(paymentAmount) || paymentAmount <= 0)) { message.textContent = 'Isi pembayaran atau centang Belum dibayar untuk menyimpan nota tanpa DP.'; return; }
      if (!$('#saveUnpaid').checked && method !== 'cash' && paymentAmount > total) { message.textContent = `Pembayaran ${method.toUpperCase()} melebihi tagihan ${money(total)}.`; return; }
      const button = $('#paySale'); const originalButton = button.innerHTML; button.disabled = true; button.setAttribute('aria-busy', 'true'); button.textContent = 'Menyimpan transaksi…';
      try {
        const sale = await window.cashierApi('/api/cashier/sales', {method:'POST', body:JSON.stringify({customer_name:$('#customerInput').value,material_id:designMaterialId,items:cart.map((item) => ({product_id:item.product.id,quantity:item.quantity,specification:item.specification || '',width:item.width,height:item.height,dimension_unit:item.dimension_unit})),payment:$('#saveUnpaid').checked ? null : {method:$('#paymentMethod').value,amount:paymentAmount}})});
        cart = []; $('#customerInput').value = ''; $('#cashierDesignMaterial').value = ''; $('#cashierDesignMaterialSummary').textContent = 'Belum ada material dipilih'; $('#cashierChooseMaterial').textContent = 'Pilih material'; $('#paymentAmount').value = ''; $('#saveUnpaid').checked = false; $('#paymentAmount').disabled = false; $('#paymentMethod').disabled = false; renderCart(); renderReceipt(sale); toast('Transaksi tersimpan.');
        try { await refreshStats(); } catch (statsError) { console.warn('Ringkasan Kasir belum dapat diperbarui:', statsError); }
      } catch (error) { message.textContent = error.message; }
      finally { button.innerHTML = originalButton; button.disabled = false; button.removeAttribute('aria-busy'); }
    });
    $('#closeReceipt').addEventListener('click', () => { $('#receiptModal').hidden = true; });
    $('#receiptModal').addEventListener('click', (event) => { if (event.target.id === 'receiptModal') $('#receiptModal').hidden = true; });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const modal = $('#cashierActionModal');
      if (modal && !modal.hidden) {
        modal.hidden = true;
        $('#cashierActionForm').onsubmit = null;
      } else if (!$('#receiptModal').hidden) $('#receiptModal').hidden = true;
    });
    $('#printReceipt').addEventListener('click', () => {
      const originalTitle = document.title;
      const invoice = String(window.currentCashierSale?.invoice_number || $('#receiptTitle')?.textContent || 'nota').replace(/^Nota\s*/i, '');
      document.title = invoice.replace(/[\\/:*?"<>|]+/g, '-');
      window.addEventListener('afterprint', () => { document.title = originalTitle; }, {once:true});
      window.print();
    });
  }
  function bindMobilePaymentJump() {
    const button = $('#mobileGoToPayment'); const panel = $('#cartPanel'); const bar = $('#cashierMobileBar');
    if (!button || !panel || !bar) return;
    button.addEventListener('click', () => {
      bar.classList.add('is-hidden'); bar.setAttribute('aria-hidden', 'true');
      panel.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'});
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        const hidden = entry.isIntersecting;
        bar.classList.toggle('is-hidden', hidden);
        bar.setAttribute('aria-hidden', String(hidden));
      }, {threshold:0.05, rootMargin:'0px 0px -24% 0px'});
      observer.observe(panel);
    }
  }
  window.cashierRenderReceipt = renderReceipt;
  window.cashierRefreshStats = refreshStats;
  window.cashierMoney = money;
  window.cashierDateLabel = dateLabel;
  window.cashierToast = toast;
  window.cashierReady.then(async () => {
    try {
      setupCatalogPicker();
      const loaded = await window.cashierApi('/api/cashier/catalog'); products = Array.isArray(loaded) ? loaded : [];
      try { const loadedMaterials = await window.cashierApi('/api/cashier/materials'); materials = Array.isArray(loadedMaterials) ? loadedMaterials : []; }
      catch (materialError) { materials = []; console.warn('Data material kasir tidak dapat dimuat:', materialError); }
      setupDesignMaterialField();
      $('#catalogCount').textContent = String(products.filter((product) => Number(product.base_price) > 0).length);
      renderProducts(); renderCart(); bindSale(); bindMobilePaymentJump(); await refreshStats();
    } catch (error) { $('#cashierMessage').textContent = error.message; $('#productGrid').innerHTML = '<div class="no-results">Katalog Kasir belum dapat dimuat.</div>'; }
    finally { window.cashierInitialized = true; window.dispatchEvent(new Event('cashier:initialized')); }
  });
})();
