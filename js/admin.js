// =================================================================
// ADMIN.JS — Logique page admin
// Dépend de : js/config.js (chargé avant), Html5Qrcode (CDN)
// =================================================================

// ---------------------------------------------------------------
// ÉTAT GLOBAL
// ---------------------------------------------------------------
let html5QrCode = null;
let isScanning  = true;
let allGuests   = [];

// ---------------------------------------------------------------
// INITIALISATION
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  document.title = `Admin — ${EVENT.fullTitle} ${EVENT.year}`;

  if (sessionStorage.getItem('jmc-admin-auth') === 'true') showDashboard();

  document.getElementById('password').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('manual-ticket-id').addEventListener('keydown', e => {
    if (e.key === 'Enter') manualScan();
  });
});

// ---------------------------------------------------------------
// AUTHENTIFICATION — validation côté serveur
// ---------------------------------------------------------------
async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errorEl  = document.getElementById('login-error');
  errorEl.textContent = '';

  try {
    const params = new URLSearchParams({ action: 'auth', username, password });
    const res    = await fetch(`${EVENT.apiUrl}?${params}`);
    const result = await res.json();

    if (result.status === 'success') {
      sessionStorage.setItem('jmc-admin-auth', 'true');
      showDashboard();
    } else {
      errorEl.textContent = 'Identifiants incorrects.';
      document.getElementById('password').value = '';
    }
  } catch (_) {
    errorEl.textContent = 'Erreur de connexion au serveur.';
  }
}

function doLogout() {
  sessionStorage.removeItem('jmc-admin-auth');
  location.reload();
}

function showDashboard() {
  document.getElementById('login-screen').style.display    = 'none';
  document.getElementById('admin-dashboard').style.display = 'block';
  loadGuestList();
}

// ---------------------------------------------------------------
// ONGLETS
// ---------------------------------------------------------------
function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
  if (tabName === 'guests') loadGuestList();
}

// ---------------------------------------------------------------
// SCANNER QR (Html5Qrcode)
// ---------------------------------------------------------------
function showState(name) {
  document.getElementById('state-ready').style.display    = name === 'ready'    ? 'block' : 'none';
  document.getElementById('state-scanning').style.display = name === 'scanning' ? 'block' : 'none';
  document.getElementById('state-result').style.display   = name === 'result'   ? 'block' : 'none';
}

async function startScanner() {
  showState('scanning');
  isScanning  = true;
  html5QrCode = new Html5Qrcode('qr-reader');

  html5QrCode
    .start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess)
    .catch(err => {
      alert('Caméra inaccessible : ' + err);
      showState('ready');
    });
}

function stopScanner() {
  if (html5QrCode && html5QrCode.isScanning) {
    html5QrCode.stop().catch(() => {});
  }
  showState('ready');
}

function onScanSuccess(decodedText) {
  if (!isScanning) return;
  isScanning = false;
  if (html5QrCode && html5QrCode.isScanning) html5QrCode.stop().catch(() => {});
  handleQRCode(decodedText);
}

function handleQRCode(raw) {
  let ticketId = raw.trim();
  try {
    const obj = JSON.parse(raw);
    if (obj.id) ticketId = obj.id;
  } catch (_) {}
  verifyTicket(ticketId);
}

function manualScan() {
  const ticketId = document.getElementById('manual-ticket-id').value.trim().toUpperCase();
  if (!ticketId) return;
  document.getElementById('manual-ticket-id').value = '';
  verifyTicket(ticketId);
}

// ---------------------------------------------------------------
// VÉRIFICATION TICKET
// ---------------------------------------------------------------
async function verifyTicket(ticketId) {
  showState('result');
  document.getElementById('state-result').innerHTML = `
    <div style="text-align:center;padding:2rem;">
      <div style="font-size:2rem;">⏳</div>
      <p style="color:#fff;margin-top:0.5rem;">Vérification en cours...</p>
    </div>`;

  let result;
  try {
    const resp = await fetch(`${EVENT.apiUrl}?action=scan&ticket_id=${encodeURIComponent(ticketId)}`);
    result = await resp.json();
  } catch (_) {
    result = { status: 'error', message: 'Impossible de contacter le serveur.' };
  }

  const styles = {
    success:        { bg: '#0d2b1a', border: '#4cc978', icon: '✅', title: 'Bienvenue !' },
    already_scanned:{ bg: '#2b1e0d', border: '#e0a050', icon: '⚠️', title: 'Déjà scanné'  },
    not_found:      { bg: '#2b0d0d', border: '#e74c3c', icon: '❌', title: 'Ticket introuvable' },
    error:          { bg: '#2b0d0d', border: '#e74c3c', icon: '❌', title: 'Erreur'        },
  };
  const s = styles[result.status] || styles.error;
  const d = result.data || {};

  const details = result.data ? `
    <div style="margin:1rem 0;text-align:left;font-size:0.95rem;">
      <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.15);">
        <b>Nom</b><span>${d.full_name || '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.15);">
        <b>Téléphone</b><span>${d.phone || '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.15);">
        <b>Église</b><span>${d.church || '—'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:0.5rem 0;">
        <b>Ticket</b><span style="font-family:monospace;">${d.ticket_id || '—'}</span>
      </div>
    </div>`
    : `<p style="color:rgba(255,255,255,0.7);margin:0.75rem 0;">${result.message || ''}</p>`;

  document.getElementById('state-result').innerHTML = `
    <div style="background:${s.bg};border:2px solid ${s.border};border-radius:16px;padding:2rem;color:#fff;text-align:center;">
      <div style="font-size:4rem;">${s.icon}</div>
      <h2 style="color:${s.border};margin:0.5rem 0;font-family:var(--font-display);">${s.title}</h2>
      ${details}
      <button onclick="isScanning=true;showState('ready')"
        style="margin-top:1.5rem;padding:0.8rem;width:100%;background:${s.border};border:none;border-radius:8px;color:#000;font-weight:700;font-size:1rem;cursor:pointer;">
        Scanner suivant
      </button>
    </div>`;
}

// ---------------------------------------------------------------
// LISTE DES INSCRITS
// ---------------------------------------------------------------
async function loadGuestList() {
  const loading   = document.getElementById('guest-list-loading');
  const tableWrap = document.getElementById('guest-table-wrap');
  loading.style.display   = 'block';
  tableWrap.style.display = 'none';

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    const response   = await fetch(`${EVENT.apiUrl}?action=list`, { signal: controller.signal });
    clearTimeout(timeout);
    const result = await response.json();

    if (result.status === 'success') {
      allGuests = result.data || [];
      renderGuestList(allGuests);
      updateStats(allGuests);
      loading.style.display   = 'none';
      tableWrap.style.display = 'block';
    } else {
      loading.innerHTML = `<p style="color:var(--red);">Erreur : ${result.message}</p>`;
    }
  } catch (_) {
    loading.innerHTML = '<p style="color:var(--red);">Erreur de connexion au serveur.</p>';
  }
}

function renderGuestList(guests) {
  const tbody = document.getElementById('guest-table-body');

  if (!guests.length) {
    tbody.innerHTML =
      '<tr><td colspan="9" style="text-align:center;color:var(--white-50);padding:2rem;">Aucun inscrit.</td></tr>';
    return;
  }

  tbody.innerHTML = guests.map((g, i) => {
    const scanned = g.scan_status === 'Scanné';
    const badge   = scanned
      ? `<span style="background:var(--green-dim);color:var(--green);padding:0.2rem 0.6rem;border-radius:20px;font-size:0.75rem;">✅ Scanné</span>`
      : `<span style="background:var(--orange-dim);color:var(--orange);padding:0.2rem 0.6rem;border-radius:20px;font-size:0.75rem;">⏳ En attente</span>`;
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${g.full_name}</td>
        <td>${g.gender  || '—'}</td>
        <td>${g.phone   || '—'}</td>
        <td>${g.church  || '—'}</td>
        <td>${g.email   || '—'}</td>
        <td style="font-family:monospace;font-size:0.8rem;">${g.ticket_id}</td>
        <td>${badge}</td>
        <td>
          <button class="btn-danger" style="padding:0.3rem 0.7rem;font-size:0.8rem;"
            onclick="deleteGuest('${g.ticket_id}')">Supprimer</button>
        </td>
      </tr>`;
  }).join('');
}

function filterGuests() {
  const q = document.getElementById('search-input').value.toLowerCase();
  renderGuestList(allGuests.filter(g =>
    (g.full_name || '').toLowerCase().includes(q) ||
    (g.phone     || '').includes(q) ||
    (g.ticket_id || '').toLowerCase().includes(q)
  ));
}

function updateStats(guests) {
  const scanned = guests.filter(g => g.scan_status === 'Scanné').length;
  document.getElementById('stat-total').textContent   = guests.length;
  document.getElementById('stat-scanned').textContent = scanned;
  document.getElementById('stat-pending').textContent = guests.length - scanned;
}

async function deleteGuest(ticketId) {
  if (!confirm(`Supprimer le ticket ${ticketId} ?`)) return;
  try {
    const res    = await fetch(`${EVENT.apiUrl}?action=delete&ticket_id=${encodeURIComponent(ticketId)}`);
    const result = await res.json();
    if (result.status === 'success') loadGuestList();
    else alert('Erreur : ' + result.message);
  } catch (_) {
    alert('Erreur de connexion.');
  }
}

// ---------------------------------------------------------------
// AJOUT MANUEL
// ---------------------------------------------------------------
function openAddModal() {
  document.getElementById('add-modal').style.display = 'flex';
}

function closeAddModal() {
  document.getElementById('add-modal').style.display = 'none';
  document.getElementById('add-modal-error').style.display = 'none';
  ['add-name', 'add-phone', 'add-church', 'add-email'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('add-gender').value = '';
}

async function submitManualAdd() {
  const name   = document.getElementById('add-name').value.trim();
  const gender = document.getElementById('add-gender').value;
  const phone  = document.getElementById('add-phone').value.trim();
  const church = document.getElementById('add-church').value.trim();
  const email  = document.getElementById('add-email').value.trim();
  const errEl  = document.getElementById('add-modal-error');

  if (!name || !gender || !phone || !church) {
    errEl.textContent   = 'Veuillez remplir tous les champs obligatoires.';
    errEl.style.display = 'block';
    return;
  }

  const chars    = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ticketId   = EVENT.ticketPrefix;
  for (let i = 0; i < 6; i++) ticketId += chars[Math.floor(Math.random() * chars.length)];

  const timestamp = new Date().toLocaleString('fr-FR', { timeZone: EVENT.timezone });

  try {
    const params = new URLSearchParams({
      action: 'register', full_name: name, gender, phone, church,
      email:  email || 'N/A', ticket_id: ticketId, timestamp,
    });
    const res    = await fetch(`${EVENT.apiUrl}?${params}`);
    const result = await res.json();

    if (result.status === 'success') {
      closeAddModal();
      loadGuestList();
    } else {
      errEl.textContent   = result.message || "Erreur lors de l'ajout.";
      errEl.style.display = 'block';
    }
  } catch (_) {
    errEl.textContent   = 'Erreur de connexion au serveur.';
    errEl.style.display = 'block';
  }
}
