(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const style = document.createElement('style');
  style.textContent = '.cashier-accounts-panel{margin-top:20px}.cashier-accounts-heading{margin:0 0 14px}.cashier-accounts-heading h2{margin:0;font-size:20px}.cashier-accounts-heading p:not(.eyebrow){margin:6px 0 0;color:var(--muted);font-size:10px}.account-role-heading{margin:22px 0 12px;padding-top:18px;border-top:1px solid var(--line)}.account-role-heading h3{margin:0;font-size:15px}';
  document.head.append(style);
  const formMarkup = (user, role) => `<form class="surface-card settings-card account-form" data-account-id="${user.id}"><p class="eyebrow">${role} · ${esc(user.username.toUpperCase())}</p><h2>${esc(user.display_name)}</h2><label>Nama akun<input name="display_name" value="${esc(user.display_name)}" required></label><label>Password baru <small>(kosongkan jika tidak diubah)</small><input name="password" type="password" minlength="6" placeholder="Password baru"></label><button class="primary-button" type="submit">Simpan akun</button><small class="form-error" aria-live="polite"></small></form>`;
  const loadAccounts = async (panel) => {
    panel.innerHTML = '<article class="surface-card settings-card"><p class="eyebrow">AKUN OPERATOR & KASIR</p><h2>Memuat akun...</h2></article>';
    try {
      const [cashierResponse, operatorResponse] = await Promise.all([fetch('/api/cashier/users'), fetch('/api/operator/users')]);
      const cashiers = await cashierResponse.json(); const operators = await operatorResponse.json();
      if (!cashierResponse.ok) throw new Error(cashiers.error || 'Akun kasir gagal dimuat');
      if (!operatorResponse.ok) throw new Error(operators.error || 'Akun operator gagal dimuat');
      panel.innerHTML = `<div class="cashier-accounts-heading"><p class="eyebrow">AKSES TIM</p><h2>Profil operator & kasir</h2><p>Atur nama akun dan password untuk kedua dashboard dari satu tempat.</p></div><div class="account-role-heading"><p class="eyebrow">WORKSPACE OPERATOR</p><h3>Akun operator</h3></div><div class="settings-grid">${operators.map((user) => formMarkup(user, 'OPERATOR')).join('') || '<p class="form-error">Belum ada akun Operator.</p>'}</div><div class="account-role-heading"><p class="eyebrow">WORKSPACE KASIR</p><h3>Akun kasir</h3></div>${cashiers.length ? `<div class="settings-grid">${cashiers.map((user) => formMarkup(user, 'KASIR')).join('')}</div>` : '<article class="surface-card settings-card"><p class="form-error">Belum ada akun Kasir. Buat dengan menjalankan <code>python create_cashier_user.py</code> di folder proyek; password dimasukkan secara tersembunyi di terminal.</p></article>'}`;
      panel.querySelectorAll('.account-form').forEach((form) => form.addEventListener('submit', async (event) => {
        event.preventDefault(); const data = new FormData(form); const error = form.querySelector('.form-error'); error.textContent = '';
        try { const result = await fetch(`/api/cashier/users/${form.dataset.accountId}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({display_name:data.get('display_name'), password:data.get('password')})}); const body = await result.json(); if (!result.ok) throw new Error(body.error || 'Akun gagal disimpan'); error.textContent = 'Tersimpan.'; form.querySelector('[name="password"]').value = ''; form.querySelector('h2').textContent = body.display_name; } catch (saveError) { error.textContent = saveError.message; }
      }));
    } catch (loadError) { panel.innerHTML = `<article class="surface-card settings-card"><p class="form-error">${esc(loadError.message)}</p></article>`; }
  };
  const renderIfReady = () => { const panel = document.querySelector('#cashierAccountsPanel'); if (panel && !panel.dataset.loaded) { panel.dataset.loaded = 'true'; loadAccounts(panel); } };
  new MutationObserver(renderIfReady).observe(document.querySelector('#viewContent') || document.body, {childList:true, subtree:true});
  renderIfReady();
})();
