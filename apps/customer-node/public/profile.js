const $ = (selector) => document.querySelector(selector);
const form = $('#profileForm');
const notice = $('#profileNotice');
const profileKey = 'fazima-print-auth-user';
let auth = null;
let currentUser = null;
let firebaseReady = false;

function readAccount() {
  try { return JSON.parse(localStorage.getItem(profileKey) || '{}') || {}; } catch { return {}; }
}
function writeAccount(user) {
  const account = {uid:user.uid || '', displayName:user.displayName || '', email:user.email || '', photoURL:user.photoURL || ''};
  localStorage.setItem(profileKey, JSON.stringify(account));
  window.dispatchEvent(new CustomEvent('fazima:account-updated', {detail:account}));
  return account;
}
function showNotice(text, kind = '') {
  notice.textContent = text;
  notice.className = `profile-notice${kind ? ` ${kind}` : ''}`;
  notice.hidden = false;
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}
function identityKey(account) {
  const identity = account.uid || account.email?.toLowerCase();
  return identity ? `fazima-print-checkout-history:${identity}` : '';
}
function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {style:'currency', currency:'IDR', maximumFractionDigits:0}).format(Number(value || 0));
}
function renderVouchers(account) {
  const node = $('#profileVouchers');
  const key = account.uid ? `fazima-print-vouchers:${account.uid}` : `fazima-print-vouchers:${(account.email || '').toLowerCase()}`;
  let vouchers = [];
  try { const parsed = JSON.parse(localStorage.getItem(key) || '[]'); if (Array.isArray(parsed)) vouchers = parsed; } catch {}
  $('#voucherCount').textContent = `${vouchers.length} voucher`;
  if (!vouchers.length) {
    node.className = 'profile-empty';
    node.innerHTML = '<span class="profile-empty-icon">%</span><div><strong>Belum ada voucher</strong><p>Voucher yang diberikan untuk akun ini akan tampil di sini.</p></div>';
    return;
  }
  node.className = 'profile-voucher-list';
  node.innerHTML = vouchers.map((voucher) => `<article class="profile-voucher-item"><div><strong>${escapeHtml(voucher.title || voucher.name || 'Voucher Fazima Print')}</strong><small>${escapeHtml(voucher.description || voucher.expiresAt || 'Voucher member')}</small></div><span class="profile-voucher-code">${escapeHtml(voucher.code || 'VOUCHER')}</span></article>`).join('');
}
function renderCheckouts(account) {
  const node = $('#profileCheckouts');
  const key = identityKey(account);
  let entries = [];
  try { const parsed = JSON.parse(key ? localStorage.getItem(key) || '[]' : '[]'); if (Array.isArray(parsed)) entries = parsed; } catch {}
  const legacy = (() => { try { return JSON.parse(localStorage.getItem('fazima-print-payment-draft') || 'null'); } catch { return null; } })();
  if (legacy?.order_id && !entries.some((item) => item.order_id === legacy.order_id)) {
    entries.unshift({order_id:legacy.order_id, created_at:legacy.created_at || Date.now(), total:legacy.total, items:legacy.items || [{product:legacy.product, size:legacy.size, quantity:legacy.quantity}]});
  }
  entries.sort((a, b) => Number(b.created_at || 0) - Number(a.created_at || 0));
  $('#checkoutCount').textContent = `${entries.length} checkout`;
  if (!entries.length) {
    node.className = 'profile-empty';
    node.innerHTML = '<span class="profile-empty-icon">↗</span><div><strong>Belum ada checkout</strong><p>Checkout berikutnya dari akun ini akan tercatat di sini.</p></div>';
    return;
  }
  node.className = 'profile-checkout-list';
  node.innerHTML = entries.map((entry) => {
    const names = (entry.items || []).map((item) => `${item.product || 'Pesanan'}${item.size ? ` · ${item.size}` : ''}`).join(', ') || 'Pesanan Fazima Print';
    const date = new Date(Number(entry.created_at || Date.now())).toLocaleDateString('id-ID', {day:'numeric',month:'long',year:'numeric'});
    return `<article class="profile-checkout-item"><div><strong>${escapeHtml(names)}</strong><small>Order ${escapeHtml(entry.order_id || '-')} · ${escapeHtml(date)}</small></div><span class="profile-checkout-total">${formatMoney(entry.total)}</span></article>`;
  }).join('');
}
function renderAccount(account) {
  const name = account.displayName || account.email?.split('@')[0] || 'Member Fazima';
  $('#profileName').value = account.displayName || '';
  $('#profileEmail').value = account.email || '';
  $('#profileAccountName').textContent = name;
  $('#profileAccountEmail').textContent = account.email || '';
  const avatar = $('#profileAvatarImage');
  const icon = $('#profileAvatarIcon');
  const heroAvatar = $('#profileHeroAvatarImage');
  const heroIcon = $('#profileHeroAvatarIcon');
  if (account.photoURL) {
    avatar.src = account.photoURL;
    avatar.hidden = false;
    icon.hidden = true;
    heroAvatar.src = account.photoURL;
    heroAvatar.hidden = false;
    heroIcon.hidden = true;
  } else {
    avatar.removeAttribute('src');
    avatar.hidden = true;
    icon.hidden = false;
    heroAvatar.removeAttribute('src');
    heroAvatar.hidden = true;
    heroIcon.hidden = false;
  }
  $('#resetProfilePhoto').hidden = !account.photoURL;
  renderVouchers(account);
  renderCheckouts(account);
}

// Render saved account data immediately; the profile remains usable while Firebase loads.
renderAccount(readAccount());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = $('#profileName').value.trim();
  if (!displayName) return showNotice('Nama tidak boleh kosong.', 'error');
  const button = $('#saveProfileName');
  button.disabled = true;
  button.textContent = 'Menyimpan…';
  try {
    if (!firebaseReady || !currentUser) throw new Error('Sesi Google belum siap. Muat ulang halaman atau masuk kembali.');
    await firebaseModules.auth.updateProfile(currentUser, {displayName});
    currentUser = auth.currentUser || {...currentUser, displayName};
    const account = writeAccount({...currentUser, displayName});
    renderAccount(account);
    showNotice('Nama profil berhasil diperbarui.');
  } catch (error) {
    showNotice(error.message || 'Nama profil belum dapat disimpan.', 'error');
  } finally {
    button.disabled = !firebaseReady || !currentUser;
    button.textContent = 'Simpan nama';
  }
});

$('#chooseProfilePhoto').addEventListener('click', () => $('#profilePhotoInput').click());
$('#profilePhotoInput').addEventListener('change', async (event) => {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) return showNotice('Pilih file gambar untuk foto profil.', 'error');
  if (file.size > 5 * 1024 * 1024) return showNotice('Ukuran foto maksimal 5 MB.', 'error');
  if (!firebaseReady || !currentUser) return showNotice('Tunggu sampai akun Google selesai dimuat, lalu pilih foto lagi.', 'error');
  const button = $('#chooseProfilePhoto');
  button.disabled = true;
  button.textContent = 'Mengunggah foto…';
  try {
    const storageModule = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js');
    const {ref, getStorage, uploadBytes, getDownloadURL} = storageModule;
    const extension = ({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'}[file.type]) || 'img';
    const avatarRef = ref(getStorage(auth.app), `profile-photos/${currentUser.uid}/avatar.${extension}`);
    const uploaded = await uploadBytes(avatarRef, file, {contentType:file.type, cacheControl:'public,max-age=3600'});
    const downloadURL = `${await getDownloadURL(uploaded.ref)}&v=${Date.now()}`;
    await firebaseModules.auth.updateProfile(currentUser, {photoURL:downloadURL});
    currentUser = auth.currentUser || {...currentUser, photoURL:downloadURL};
    const account = writeAccount({...currentUser, photoURL:downloadURL});
    renderAccount(account);
    showNotice('Foto profil berhasil diperbarui.');
  } catch (error) {
    const message = error?.code === 'storage/unauthorized'
      ? 'Firebase Storage menolak upload. Periksa aturan akses Storage untuk folder profile-photos/{uid}.'
      : (error.message || 'Foto profil gagal diunggah.');
    showNotice(message, 'error');
  } finally {
    button.disabled = !firebaseReady || !currentUser;
    button.textContent = 'Ganti foto';
  }
});

$('#resetProfilePhoto').addEventListener('click', async () => {
  if (!firebaseReady || !currentUser) return showNotice('Sesi Google belum siap.', 'error');
  const button = $('#resetProfilePhoto');
  button.disabled = true;
  try {
    await firebaseModules.auth.updateProfile(currentUser, {photoURL:null});
    currentUser = auth.currentUser || {...currentUser, photoURL:''};
    const account = writeAccount({...currentUser, photoURL:''});
    renderAccount(account);
    showNotice('Foto profil dihapus. Ikon profil digunakan kembali.');
  } catch (error) {
    showNotice(error.message || 'Foto profil belum dapat dihapus.', 'error');
  } finally { button.disabled = false; }
});

let firebaseModules = null;
async function init() {
  const response = await fetch('/api/firebase-config', {cache:'no-store', signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Konfigurasi akun gagal dimuat.');
  const payload = await response.json();
  if (!payload.configured) throw new Error('Firebase belum dikonfigurasi.');
  const [appModule, authModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'),
  ]);
  firebaseModules = {app:appModule, auth:authModule};
  const app = appModule.getApps().find((item) => item.name === '[DEFAULT]') || appModule.initializeApp(payload.config);
  auth = authModule.getAuth(app);
  authModule.onAuthStateChanged(auth, (user) => {
    currentUser = user;
    firebaseReady = true;
    $('#saveProfileName').disabled = !user;
    $('#chooseProfilePhoto').disabled = !user;
    if (!user) {
      showNotice('Sesi akun tidak aktif. Masuk kembali dengan Google untuk mengubah profil.', 'error');
      return;
    }
    const account = writeAccount(user);
    renderAccount(account);
    notice.hidden = true;
  });
}

init().catch((error) => {
  showNotice(error.message || 'Profil Firebase belum dapat dimuat. Data akun tersimpan tetap ditampilkan.', 'error');
});
