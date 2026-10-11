(() => {
  const key = 'fazima-cashier-session';
  const login = document.querySelector('#cashierLogin');
  const app = document.querySelector('.cashier-app');
  const boot = document.querySelector('#cashierAuthBoot');
  const form = document.querySelector('#cashierLoginForm');
  const error = document.querySelector('#cashierLoginError');
  const readSession = () => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; } };
  const saveSession = (session) => localStorage.setItem(key, JSON.stringify(session));
  const show = (session) => {
    window.cashierCurrentUser = session;
    boot.hidden = false; login.hidden = true; app.hidden = true;
    boot.textContent = 'Menyiapkan dashboard kasir...';
    const name = document.querySelector('.cashier-identity b');
    const label = document.querySelector('.cashier-identity small');
    const avatar = document.querySelector('.cashier-avatar');
    if (name) name.textContent = session.display_name;
    if (label) label.textContent = `Kasir · ${session.username}`;
    if (avatar) avatar.textContent = session.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  };
  window.cashierRevealApp = () => { boot.hidden = true; login.hidden = true; app.hidden = false; };
  window.cashierToken = () => readSession()?.token || '';
  window.cashierApi = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    const token = window.cashierToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(path, {...options, headers});
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) {
      const invalid = new Error(body.error || 'Sesi kasir tidak valid.'); invalid.status = 401; throw invalid;
    }
    if (!response.ok) { const failure = new Error(body.error || `Permintaan gagal (${response.status})`); failure.status = response.status; throw failure; }
    return body;
  };
  window.cashierReady = (async () => {
    const session = readSession();
    if (session?.token) {
      try { const actor = await window.cashierApi('/api/cashier/session'); const verified = {...actor, token:session.token}; saveSession(verified); show(verified); return verified; }
      catch (authError) {
        if (authError.status === 401) { /* Keep the stored token until the user explicitly logs out. */ }
        else { show(session); return session; }
      }
    }
    boot.hidden = true; login.hidden = false; app.hidden = true;
    return new Promise((resolve) => {
      form.addEventListener('submit', async (event) => {
        event.preventDefault(); error.textContent = '';
        const button = form.querySelector('button[type="submit"]'); button.disabled = true;
        try {
          const response = await fetch('/api/cashier/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:form.elements.username.value, password:form.elements.password.value})});
          const body = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(body.error || 'Login gagal');
          saveSession(body); sessionStorage.removeItem('cashier.currentPage'); form.elements.password.value = ''; show(body); resolve(body);
        } catch (e) { error.textContent = e.message; form.elements.password.select(); }
        finally { button.disabled = false; }
      });
    });
  })();
  document.querySelector('#cashierLogout')?.addEventListener('click', async () => {
    const button = document.querySelector('#cashierLogout'); button.disabled = true;
    try { await window.cashierApi('/api/cashier/logout', {method:'POST', body:'{}'}); localStorage.removeItem(key); sessionStorage.removeItem('cashier.currentPage'); location.reload(); }
    catch (logoutError) { window.cashierToast?.(logoutError.message || 'Logout gagal. Coba lagi.'); button.disabled = false; }
  });
})();
