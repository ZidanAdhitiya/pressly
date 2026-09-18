(() => {
  const SESSION_KEY = 'fazima-operator-session';
  const loginScreen = document.querySelector('#operatorLogin');
  const dashboard = document.querySelector('.operator-dashboard');
  if (!loginScreen || !dashboard) return;
  const profiles = loginScreen.querySelector('#operatorProfiles');
  const username = loginScreen.querySelector('#operatorUsername');
  const password = loginScreen.querySelector('#operatorPassword');
  const error = loginScreen.querySelector('#operatorLoginError');
  const identity = document.querySelector('#operatorIdentity');
  const setIdentity = (user) => { if (identity) identity.textContent = user.display_name; };
  const showDashboard = (user) => { setIdentity(user); loginScreen.hidden = true; dashboard.hidden = false; };
  const showLogin = () => { dashboard.hidden = true; loginScreen.hidden = false; password.value = ''; error.textContent = ''; };
  const session = sessionStorage.getItem(SESSION_KEY);
  if (session) { try { showDashboard(JSON.parse(session)); } catch { sessionStorage.removeItem(SESSION_KEY); showLogin(); } } else showLogin();
  fetch('/api/operator/users').then((response) => response.json()).then((users) => {
    profiles.innerHTML = users.filter((user) => user.is_active).map((user, index) => `<button class="operator-profile${index === 0 ? ' active' : ''}" type="button" data-username="${user.username}"><span class="operator-profile-avatar">${user.display_name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><b>${user.display_name}</b><small>Operator · pilih akun</small></button>`).join('');
    const select = (button) => { profiles.querySelectorAll('.operator-profile').forEach((item) => item.classList.toggle('active', item === button)); username.value = button.dataset.username; password.focus(); };
    profiles.querySelectorAll('.operator-profile').forEach((button) => button.addEventListener('click', () => select(button)));
    if (profiles.firstElementChild) username.value = profiles.firstElementChild.dataset.username;
  }).catch(() => { error.textContent = 'Daftar akun operator gagal dimuat dari database.'; });
  loginScreen.querySelector('#operatorLoginForm').addEventListener('submit', async (event) => {
    event.preventDefault(); error.textContent = '';
    try { const response = await fetch('/api/operator/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:username.value, password:password.value})}); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Login gagal'); sessionStorage.setItem(SESSION_KEY, JSON.stringify(body)); showDashboard(body); } catch (loginError) { error.textContent = loginError.message; password.select(); }
  });
  document.querySelector('#operatorLogout')?.addEventListener('click', () => { sessionStorage.removeItem(SESSION_KEY); showLogin(); });
})();
