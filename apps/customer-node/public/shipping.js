(() => {
  window.fazimaSelectedShippingQuote = null;
  const originalApi = window.api;
  if (typeof originalApi === 'function') {
    window.api = async (path, options = {}) => {
      let nextOptions = options;
      if (path === '/api/orders' && options.body) {
        try {
          const payload = JSON.parse(options.body);
          payload.shipping_selection = window.fazimaSelectedShippingQuote ? {
            destination_id: window.fazimaSelectedShippingQuote.destination_id,
            courier: window.fazimaSelectedShippingQuote.courier,
            service: window.fazimaSelectedShippingQuote.service,
          } : null;
          nextOptions = {...options, body:JSON.stringify(payload)};
        } catch (_) {}
      }
      if (path === '/api/payments/snap-token' && options.body) {
        try {
          const payload = JSON.parse(options.body);
          const draft = JSON.parse(localStorage.getItem('fazima-print-payment-draft') || 'null');
          if (draft?.shipping_cost > 0 && !payload.item_details.some((item) => item.id === 'shipping-estimate')) {
            payload.item_details.push({id:'shipping-estimate', name:`Ongkir ${draft.shipping_courier || 'Kurir'}`, price:Math.round(draft.shipping_cost), quantity:1});
          }
          nextOptions = {...options, body:JSON.stringify(payload)};
        } catch (_) {}
      }
      const result = await originalApi(path, nextOptions);
      if (path === '/api/orders' && window.fazimaLastCheckoutDraft && Number.isFinite(Number(result.shipping_cost))) {
        window.fazimaLastCheckoutDraft.shipping_cost = Number(result.shipping_cost);
        window.fazimaLastCheckoutDraft.shipping_courier = result.shipping_courier || window.fazimaLastCheckoutDraft.shipping_courier;
      }
      return result;
    };
  }
  const originalCartPaymentDraft = window.cartPaymentDraft;
  if (typeof originalCartPaymentDraft === 'function') {
    window.cartPaymentDraft = () => {
      const draft = originalCartPaymentDraft();
      const quote = window.fazimaSelectedShippingQuote;
      if (quote) {
        draft.shipping_selection = {destination_id:quote.destination_id, courier:quote.courier, service:quote.service};
        draft.shipping_cost = Number(quote.cost || 0);
        draft.shipping_courier = `${quote.courier_name || quote.courier} ${quote.service}`;
      }
      window.fazimaLastCheckoutDraft = draft;
      return draft;
    };
  }
  const money = (value) => new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(Number(value || 0));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const request = async (url, options) => {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Layanan estimasi ongkir belum tersedia.');
    return data;
  };
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page !== 'cart') return;
    // The main cart boot waits for catalog hydration before rebuilding the address section.
    // Mount after that rebuild so these controls are not discarded by its initialization.
    const mountReady = new Promise((resolve) => {
      const started = Date.now();
      const poll = window.setInterval(() => {
        if (document.querySelector('#cancelLocation') || Date.now() - started > 10000) {
          window.clearInterval(poll); resolve();
        }
      }, 100);
    });
    mountReady.then(() => mountShippingEstimate());
  });
  function mountShippingEstimate() {
    const addressSection = document.querySelector('#addressSection');
    const addressLabel = document.querySelector('#addressLabel');
    if (!addressSection || !addressLabel) return;
    const areaLabel = document.createElement('label');
    areaLabel.className = 'cart-field-label shipping-area-label';
    areaLabel.innerHTML = 'Kecamatan / kelurahan tujuan<input id="shippingAreaSearch" autocomplete="off" placeholder="Cari wilayah, contoh: Coblong, Bandung"><small>Pilih wilayah yang paling sesuai. Alamat rumah tidak perlu diketik ulang di sini.</small>';
    const results = document.createElement('div'); results.id = 'shippingAreaResults'; results.className = 'shipping-area-results'; results.setAttribute('role','listbox'); results.hidden = true;
    const status = document.createElement('p'); status.id = 'shippingAreaStatus'; status.className = 'location-status'; status.setAttribute('aria-live','polite'); status.textContent = 'Pilih wilayah tujuan untuk melihat estimasi JNE dan J&T.';
    const rates = document.createElement('div'); rates.id = 'shippingRates'; rates.className = 'shipping-rates'; rates.setAttribute('aria-live','polite'); rates.hidden = true;
    addressSection.insertBefore(rates, addressLabel);
    addressSection.insertBefore(status, rates);
    addressSection.insertBefore(results, status);
    addressSection.insertBefore(areaLabel, results);
    const input = areaLabel.querySelector('input');
    const totalNode = document.querySelector('#cartTotal');
    const totalPanel = totalNode?.parentElement;
    const summary = document.createElement('div'); summary.className = 'cart-shipping-summary'; summary.hidden = true;
    summary.innerHTML = '<div><span id="shippingSummaryLabel">Estimasi ongkir</span><b id="shippingSummaryCost">-</b></div><div class="shipping-grand-total"><span>Total estimasi</span><b id="shippingGrandTotal">-</b></div>';
    totalNode?.insertAdjacentElement('afterend', summary);
    let timer; let requestNumber = 0;
    const isCourierDelivery = () => document.querySelector('input[name="delivery"]:checked')?.value === 'delivery';
    const syncShippingMode = () => {
      const courierDelivery = isCourierDelivery();
      areaLabel.hidden = !courierDelivery;
      results.hidden = !courierDelivery || results.childElementCount === 0;
      status.hidden = !courierDelivery;
      rates.hidden = !courierDelivery || rates.childElementCount === 0;
      if (!courierDelivery) {
        requestNumber++;
        clearTimeout(timer);
        results.replaceChildren();
        rates.replaceChildren();
        window.fazimaSelectedShippingQuote = null;
        summary.hidden = true;
      }
    };
    document.querySelectorAll('input[name="delivery"]').forEach((radio) => radio.addEventListener('change', syncShippingMode));
    const syncSummary = () => {
      const selected = window.fazimaSelectedShippingQuote;
      const productTotal = Number(String(totalNode?.textContent || '').replace(/[^0-9]/g, '')) || 0;
      summary.hidden = !selected;
      if (!selected) return;
      document.querySelector('#shippingSummaryLabel').textContent = `Ongkir ${selected.courier_name || selected.courier} ${selected.service} (estimasi)`;
      document.querySelector('#shippingSummaryCost').textContent = money(selected.cost);
      document.querySelector('#shippingGrandTotal').textContent = money(productTotal + Number(selected.cost || 0));
      const note = totalPanel?.querySelector('small');
      if (note) note.textContent = 'Ongkir masih estimasi dan akan diverifikasi saat order dibuat.';
    };
    if (totalNode) new MutationObserver(syncSummary).observe(totalNode, {childList:true, characterData:true, subtree:true});
    syncShippingMode();
    document.querySelectorAll('input[name="delivery"]').forEach((radio) => radio.addEventListener('change', () => {
      if (radio.checked && radio.value !== 'delivery') { window.fazimaSelectedShippingQuote = null; syncSummary(); }
    }));
    for (const button of [document.querySelector('#demoCheckout'), document.querySelector('#payDemoCheckout')]) {
      button?.addEventListener('click', (event) => {
        if (document.querySelector('input[name="delivery"]:checked')?.value === 'delivery' && !window.fazimaSelectedShippingQuote) {
          event.preventDefault(); event.stopImmediatePropagation();
          status.textContent = 'Pilih salah satu layanan JNE atau J&T agar total estimasi pengiriman dihitung.';
          input.focus();
        }
      }, true);
    }
    const findAreas = async (query) => {
      if (!isCourierDelivery()) return;
      const id = ++requestNumber;
      window.fazimaSelectedShippingQuote = null; syncSummary();
      rates.hidden = true; rates.replaceChildren();
      if (query.trim().length < 3) { results.hidden = true; status.textContent = 'Ketik minimal 3 huruf nama kecamatan, kelurahan, atau kode pos.'; return; }
      status.textContent = 'Mencari wilayah…';
      try {
        const response = await request(`/api/shipping/destinations?search=${encodeURIComponent(query.trim())}`);
        if (id !== requestNumber || !isCourierDelivery()) return;
        const destinations = response.data || [];
        results.innerHTML = destinations.map((item, index) => `<button type="button" role="option" data-index="${index}">${escapeHtml(item.label)}${item.zip_code ? ` · ${escapeHtml(item.zip_code)}` : ''}</button>`).join('');
        results.hidden = !destinations.length;
        status.textContent = destinations.length ? 'Pilih wilayah tujuan yang sesuai untuk memuat tarif.' : 'Wilayah tidak ditemukan. Coba nama kecamatan atau kode pos.';
        results.querySelectorAll('[data-index]').forEach((button) => button.addEventListener('click', async () => {
          if (!isCourierDelivery()) return;
          const destination = destinations[Number(button.dataset.index)];
          input.value = destination.label; results.hidden = true; status.textContent = `Menghitung tarif untuk ${destination.label}…`;
          try {
            const quote = await request('/api/shipping/rates', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({destination_id:destination.id})});
            if (!isCourierDelivery()) return;
            const weight = Number(quote.estimated_weight_grams || 1000).toLocaleString('id-ID');
            status.textContent = quote.message || `Estimasi berdasarkan berat paket ${weight} gram.`;
            rates.innerHTML = (quote.data || []).map((rate, index) => `<button type="button" class="shipping-rate" data-rate-index="${index}" aria-pressed="false"><span><b>${escapeHtml(rate.courier)} ${escapeHtml(rate.service)}</b><small>${escapeHtml(rate.description || '')}${rate.etd ? ` · Estimasi ${escapeHtml(rate.etd)}` : ''}</small></span><strong>${money(rate.cost)}</strong></button>`).join('');
            rates.querySelectorAll('[data-rate-index]').forEach((rateButton) => rateButton.addEventListener('click', () => {
              const rate = quote.data[Number(rateButton.dataset.rateIndex)];
              window.fazimaSelectedShippingQuote = {destination_id:destination.id, courier:rate.code, courier_name:rate.courier, service:rate.service, cost:Number(rate.cost)};
              rates.querySelectorAll('[data-rate-index]').forEach((other) => other.setAttribute('aria-pressed', String(other === rateButton)));
              syncSummary(); status.textContent = `Estimasi ${rate.courier} ${rate.service} dipilih. Total produk dan ongkir sudah diringkas di bawah.`;
            }));
            if (!quote.data?.length) rates.innerHTML = `<p>${escapeHtml(quote.message || 'Tarif tidak ditemukan untuk wilayah ini.')}</p>`;
            rates.hidden = false;
          } catch (error) { status.textContent = error.message; }
        }));
      } catch (error) { if (id === requestNumber) { results.hidden = true; status.textContent = error.message; } }
    };
    input.addEventListener('input', () => { window.fazimaSelectedShippingQuote = null; syncSummary(); clearTimeout(timer); timer = setTimeout(() => findAreas(input.value), 350); });
    // GPS reverse-geocoding is for the customer's address only. Courier area
    // lookup starts only after the customer types a destination in this field.
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.page !== 'payment') return;
    const summary = document.querySelector('#paymentOrderSummary');
    if (!summary) return;
    const renderShipping = () => {
      summary.querySelector('[data-shipping-summary]')?.remove();
      const draft = JSON.parse(localStorage.getItem('fazima-print-payment-draft') || 'null');
      if (draft?.shipping_mode === 'gosend') {
        const row = document.createElement('div'); row.dataset.shippingSummary = 'true';
        row.innerHTML = '<b>GoSend</b><span>Ongkir dibayar customer ke driver (COD)</span>';
        summary.append(row); return;
      }
      if (!draft?.shipping_cost) return;
      const row = document.createElement('div'); row.dataset.shippingSummary = 'true';
      row.innerHTML = `<b>Ongkir ${escapeHtml(draft.shipping_courier || 'kurir')}</b><span>Estimasi ${money(draft.shipping_cost)}</span>`;
      summary.append(row);
    };
    new MutationObserver(renderShipping).observe(summary, {childList:true, subtree:true});
    renderShipping();
  });
})();
