(() => {
  const mount = document.querySelector('[data-global-nav]');
  if (!mount) return;
  const label = mount.dataset.globalNav || 'Fazima Print';
  const refresh = mount.dataset.refresh === 'true' ? '<button id="refreshCatalog" class="global-refresh" type="button">↻ Refresh data</button>' : '';
  const today = new Intl.DateTimeFormat('id-ID', {day: '2-digit', month: 'long', year: 'numeric'}).format(new Date());
  mount.innerHTML = `<header class="global-navbar"><a class="global-brand" href="/" aria-label="Kembali ke home"><img src="assets/branding/fazima-print-logo.png" alt="Fazima Print"><span class="global-page">${label}</span></a><div class="global-meta">${refresh}<span>Fazima Print Management System · <time class="global-date" datetime="${new Date().toISOString().slice(0, 10)}">${today}</time></span></div></header>`;
})();
