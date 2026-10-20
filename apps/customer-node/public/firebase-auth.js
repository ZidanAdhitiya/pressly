import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence,
  signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut,
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const googleButton = document.querySelector('#googleLogin');
const message = document.querySelector('#authMessage');
let auth = null;
const buttonLabel = googleButton?.querySelector('.google-button-label');
const defaultLabel = buttonLabel?.textContent || 'Lanjut dengan Google';

const show = (text, kind = '') => {
  if (!message) return;
  message.textContent = text;
  message.className = `auth-message ${kind}`;
};

const busy = (value) => {
  if (!googleButton) return;
  googleButton.disabled = value;
  googleButton.setAttribute('aria-busy', String(value));
  googleButton.classList.toggle('is-loading', value);
  if (buttonLabel) buttonLabel.textContent = value ? 'Menyiapkan Google…' : defaultLabel;
};

const friendly = (error) => ({
  'auth/popup-closed-by-user': 'Popup Google ditutup sebelum selesai.',
  'auth/popup-blocked': 'Popup diblokir browser. Izinkan popup atau coba lagi.',
  'auth/operation-not-allowed': 'Login Google belum diaktifkan di Firebase Authentication.',
  'auth/invalid-api-key': 'API key Firebase tidak valid. Periksa FIREBASE_API_KEY di Hostinger.',
  'auth/network-request-failed': 'Koneksi ke Google/Firebase gagal. Periksa koneksi lalu coba lagi.',
  'auth/unauthorized-domain': `Domain ${window.location.hostname} belum ditambahkan ke Firebase Authorized Domains. Tambahkan hostname ini di Firebase Console > Authentication > Settings > Authorized domains.`,
}[error?.code] || error?.message || 'Autentikasi Google gagal.');

const finish = (user) => {
  if (!user) return;
  localStorage.setItem('fazima-print-auth-user', JSON.stringify({
    uid: user.uid,
    displayName: user.displayName || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
  }));
  show(`Masuk sebagai ${user.displayName || user.email}.`, 'success');
  window.setTimeout(() => window.location.assign('/'), 500);
};

const init = async () => {
  if (!googleButton) return;
  busy(true);
  show('Menyiapkan koneksi Google…');
  const response = await fetch('/api/firebase-config', {cache: 'no-store', signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(`Konfigurasi login gagal dimuat (HTTP ${response.status}).`);
  const payload = await response.json();
  if (!payload.configured) {
    show('Login Google belum dikonfigurasi. Isi FIREBASE_* di .env backend.', 'warning');
    busy(false);
    return;
  }
  auth = getAuth(initializeApp(payload.config));
  await setPersistence(auth, browserLocalPersistence);
  onAuthStateChanged(auth, (user) => { if (user) finish(user); });
  try {
    const result = await getRedirectResult(auth);
    if (result?.user) finish(result.user);
  } catch (error) {
    show(friendly(error), 'error');
  }
  busy(false);
};

googleButton?.addEventListener('click', async () => {
  if (!auth) {
    show('Koneksi Google belum siap. Tunggu sebentar, lalu coba lagi.', 'warning');
    return;
  }
  busy(true);
  show(window.matchMedia('(max-width: 680px)').matches ? 'Mengalihkan ke Google…' : 'Membuka login Google…');
  try {
    const provider = new GoogleAuthProvider();
    if (window.matchMedia('(max-width: 680px)').matches) {
      await signInWithRedirect(auth, provider);
    } else {
      finish((await signInWithPopup(auth, provider)).user);
    }
  } catch (error) {
    busy(false);
    show(friendly(error), 'error');
  }
});

init().catch((error) => { busy(false); show(friendly(error), 'error'); });
window.fazimaFirebaseSignOut = () => auth ? signOut(auth) : Promise.resolve();
