/* ui.js — UI manager (no module syntax for single-file compat) */

// ── Auth ────────────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

function loginUser() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const msg  = document.getElementById('login-msg');

  if (!user || !pass) { msg.textContent = 'Completa todos los campos.'; return; }

  const accounts = JSON.parse(localStorage.getItem('liminal_accounts') || '{}');
  if (!accounts[user]) { msg.textContent = 'Usuario no encontrado.'; return; }
  if (accounts[user].password !== btoa(pass)) { msg.textContent = 'Contraseña incorrecta.'; return; }

  msg.style.color = '#7fbf9e';
  msg.textContent = '¡Bienvenido de vuelta!';
  setTimeout(() => startGameSession(user, accounts[user].save || null), 800);
}

function registerUser() {
  const user  = document.getElementById('reg-user').value.trim();
  const pass  = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  const msg   = document.getElementById('reg-msg');

  if (!user || !pass) { msg.textContent = 'Completa todos los campos.'; return; }
  if (pass !== pass2) { msg.textContent = 'Las contraseñas no coinciden.'; return; }
  if (user.length < 3) { msg.textContent = 'El nombre debe tener al menos 3 caracteres.'; return; }
  if (pass.length < 4) { msg.textContent = 'La contraseña debe tener al menos 4 caracteres.'; return; }

  const accounts = JSON.parse(localStorage.getItem('liminal_accounts') || '{}');
  if (accounts[user]) { msg.textContent = 'Ese nombre ya está en uso.'; return; }

  accounts[user] = { password: btoa(pass), save: null };
  localStorage.setItem('liminal_accounts', JSON.stringify(accounts));

  msg.style.color = '#7fbf9e';
  msg.textContent = '¡Cuenta creada!';
  setTimeout(() => startGameSession(user, null), 800);
}

function logoutUser() {
  window.currentUser = null;
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('pause-menu').classList.add('hidden');
  document.getElementById('joystick-container').classList.add('hidden');
  document.getElementById('btn-interact').classList.add('hidden');
  document.getElementById('btn-jump').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  if (window.gameInstance) window.gameInstance.pause();
}

// ── Save/Load ────────────────────────────────────────────────────────────────
function saveGame() {
  if (!window.currentUser || !window.gameInstance) return;
  const accounts = JSON.parse(localStorage.getItem('liminal_accounts') || '{}');
  accounts[window.currentUser].save = window.gameInstance.getSaveData();
  localStorage.setItem('liminal_accounts', JSON.stringify(accounts));
  showToast('✓ Progreso guardado');
  document.getElementById('pause-menu').classList.add('hidden');
  if (window.gameInstance) window.gameInstance.resume();
}

// ── HUD helpers ─────────────────────────────────────────────────────────────
function updateHUD(user, level, items, total) {
  document.getElementById('hud-user').textContent = user;
  document.getElementById('hud-level').textContent = level;
  document.getElementById('hud-items').textContent = `🔑 ${items} / ${total}`;
}

function showInteractionPrompt(text) {
  const el = document.getElementById('interaction-prompt');
  document.getElementById('prompt-text').textContent = text || 'Presiona [E] para interactuar';
  el.classList.remove('hidden');
}
function hideInteractionPrompt() {
  document.getElementById('interaction-prompt').classList.add('hidden');
}

function showToast(msg) {
  const el = document.getElementById('found-toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  // Re-trigger animation
  el.style.animation = 'none';
  void el.offsetHeight;
  el.style.animation = 'toast-fade 3s forwards';
  setTimeout(() => el.classList.add('hidden'), 3100);
}

function updateCompass(angleDeg) {
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  const idx = Math.round(((angleDeg % 360) + 360) % 360 / 45) % 8;
  document.getElementById('compass-needle').textContent = dirs[idx];
}

// ── Pause ───────────────────────────────────────────────────────────────────
function resumeGame() {
  document.getElementById('pause-menu').classList.add('hidden');
  if (window.gameInstance) window.gameInstance.resume();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && window.gameInstance && window.gameInstance.running) {
    const pm = document.getElementById('pause-menu');
    if (pm.classList.contains('hidden')) {
      pm.classList.remove('hidden');
      window.gameInstance.pause();
    } else {
      pm.classList.add('hidden');
      window.gameInstance.resume();
    }
  }
});

// ── Level transition overlay ─────────────────────────────────────────────────
function showLevelTransition(text, callback) {
  const el = document.getElementById('level-transition');
  document.getElementById('transition-text').textContent = text;
  el.classList.remove('hidden');
  setTimeout(() => {
    if (callback) callback();
    setTimeout(() => el.classList.add('hidden'), 800);
  }, 1800);
}

// ── Loading screen ───────────────────────────────────────────────────────────
function setLoadingProgress(pct, text) {
  document.getElementById('loading-bar').style.width = pct + '%';
  if (text) document.getElementById('loading-text').textContent = text;
}
function hideLoadingScreen(callback) {
  const el = document.getElementById('loading-screen');
  el.style.transition = 'opacity 1s ease';
  el.style.opacity = '0';
  setTimeout(() => {
    el.classList.add('hidden');
    if (callback) callback();
  }, 1000);
}
