(() => {
  const SESSION_KEY = 'fazima-cashier-session';
  const loginScreen = document.querySelector('#cashierLogin');
  const dashboard = document.querySelector('.cashier-app');
  if (!loginScreen || !dashboard) return;
  const profiles = loginScreen.querySelector('#cashierProfiles');
  const username = loginScreen.querySelector('#cashierUsername');
  const password = loginScreen.querySelector('#cashierPassword');
  const error = loginScreen.querySelector('#cashierLoginError');
  const identity = document.querySelector('.cashier-identity');
  if (identity && !identity.querySelector('#cashierLogout')) {
    const logout = document.createElement('button');
    logout.id = 'cashierLogout'; logout.type = 'button'; logout.textContent = 'Keluar';
    Object.assign(logout.style, {marginLeft: 'auto', padding: '3px 0', border: '0', color: '#a85f53', background: 'none', font: '800 9px system-ui', cursor: 'pointer'});
    identity.append(logout);
    logout.addEventListener('click', () => { sessionStorage.removeItem(SESSION_KEY); showLogin(); });
  }
  const setIdentity = (user) => {
    const name = document.querySelector('.cashier-identity b');
    const avatar = document.querySelector('.cashier-avatar');
    if (name) name.textContent = user.display_name;
    if (avatar) avatar.textContent = user.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  };
  const showDashboard = (user) => { setIdentity(user); loginScreen.hidden = true; dashboard.hidden = false; };
  const showLogin = () => { dashboard.hidden = true; loginScreen.hidden = false; password.value = ''; error.textContent = ''; };
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session) { try { showDashboard(JSON.parse(session)); } catch { sessionStorage.removeItem(SESSION_KEY); showLogin(); } } else showLogin();
  fetch('/api/cashier/users').then((response) => response.json()).then((users) => {
    profiles.innerHTML = users.filter((user) => user.is_active).map((user, index) => `<button class="cashier-profile${index === 0 ? ' active' : ''}" type="button" data-username="${user.username}"><span class="cashier-profile-avatar">${user.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><b>${user.display_name}</b><small>Kasir · pilih akun</small></button>`).join('');
    const select = (button) => { profiles.querySelectorAll('.cashier-profile').forEach((item) => item.classList.toggle('active', item === button)); username.value = button.dataset.username; password.focus(); };
    profiles.querySelectorAll('.cashier-profile').forEach((button) => button.addEventListener('click', () => select(button)));
    if (profiles.firstElementChild) username.value = profiles.firstElementChild.dataset.username;
  }).catch(() => { error.textContent = 'Daftar akun kasir gagal dimuat dari database.'; });
  loginScreen.querySelector('#cashierLoginForm').addEventListener('submit', async (event) => {
    event.preventDefault(); error.textContent = '';
    try {
      const response = await fetch('/api/cashier/login', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({username: username.value, password: password.value})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Login gagal');
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(body)); password.value = ''; showDashboard(body);
    } catch (loginError) { error.textContent = loginError.message; password.select(); }
  });
})();
