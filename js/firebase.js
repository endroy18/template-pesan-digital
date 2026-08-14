// Firebase: inisialisasi, login gate, dan referensi Realtime Database.
// Semua pengguna yang login berbagi data yang sama di path DATA_REF.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  remove,
  onValue,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2vP9pPFnkR_X1V-z2-E9c2skrSqCoBRk",
  authDomain: "template-pesan-undangan.firebaseapp.com",
  databaseURL: "https://template-pesan-undangan-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "template-pesan-undangan",
  storageBucket: "template-pesan-undangan.firebasestorage.app",
  messagingSenderId: "594530824594",
  appId: "1:594530824594:web:0c295769ad127cf241914b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Path data bersama — semua pengguna login membaca/menulis di sini.
const DATA_REF = ref(db, "app-data");

export { auth, db, DATA_REF, ref, set, remove, onValue };

// ---------- Login gate ----------
const $ = (sel) => document.querySelector(sel);
const loginScreen = $("#login-screen");
const appEl = $("#app");
const loginForm = $("#login-form");
const loginEmail = $("#login-email");
const loginPassword = $("#login-password");
const loginError = $("#login-error");
const loginSubmit = $("#login-submit");

function setBusy(busy) {
  loginSubmit.disabled = busy;
  loginSubmit.textContent = busy ? "Memasuki…" : "Masuk";
}

loginForm.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  loginError.hidden = true;
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) {
    loginError.textContent = "Isi email dan password.";
    loginError.hidden = false;
    return;
  }
  setBusy(true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    // Perpindahan layar ditangani onLogin() (onAuthStateChanged).
  } catch (err) {
    loginError.textContent = pesanError(err.code);
    loginError.hidden = false;
  } finally {
    setBusy(false);
  }
});

$("#logout").addEventListener("click", () => signOut(auth));

function pesanError(code) {
  switch (code) {
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Email atau password salah.";
    case "auth/invalid-email":
      return "Format email tidak valid.";
    case "auth/too-many-requests":
      return "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.";
    case "auth/network-request-failed":
      return "Gagal terhubung ke jaringan.";
    default:
      return "Gagal masuk. Coba lagi.";
  }
}

// Panggil cb(true) saat pengguna login, cb(false) saat keluar.
export function onLogin(cb) {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      appEl.hidden = false;
      loginScreen.hidden = true;
      cb(true);
    } else {
      appEl.hidden = true;
      loginScreen.hidden = false;
      cb(false);
    }
  });
}
