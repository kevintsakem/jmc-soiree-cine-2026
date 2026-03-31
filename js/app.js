// =================================================================
// APP.JS — Logique page d'inscription
// Dépend de : js/config.js (chargé avant), QRious (CDN), html2canvas (CDN)
// =================================================================

// ---------------------------------------------------------------
// INITIALISATION
// ---------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  initPage();
  initNav();
  initCountdown();
  initScrollReveal();
  initCapacityCheck();
  initForm();
});

function initPage() {
  document.title = `${EVENT.fullTitle} ${EVENT.year}`;

  document.getElementById('hero-date').innerHTML =
    `<strong>${EVENT.date}</strong> &nbsp;·&nbsp; ${EVENT.time}`;
  document.getElementById('hero-venue').textContent = EVENT.venue;

  const freeEl = document.getElementById('hero-free');
  if (EVENT.freeEntry) freeEl.style.display = 'inline-block';
  else freeEl.style.display = 'none';

  document.getElementById('ticket-header').textContent =
    EVENT.fullTitle.toUpperCase();
  document.getElementById('ticket-subtitle').textContent =
    `${EVENT.date} · ${EVENT.time}`;

  // Rendu du programme depuis la config
  document.getElementById('timeline').innerHTML = EVENT.programme.map(item => `
    <div class="timeline-item reveal">
      <div class="timeline-time">${item.time}</div>
      <div class="timeline-title">${item.title}</div>
      <div class="timeline-desc">${item.desc}</div>
    </div>
  `).join('');
}

// ---------------------------------------------------------------
// NAVIGATION
// ---------------------------------------------------------------
function initNav() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
  });

  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
      document.getElementById('navLinks').classList.remove('open');
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

function toggleNav() {
  document.getElementById('navLinks').classList.toggle('open');
}

// ---------------------------------------------------------------
// COUNTDOWN
// ---------------------------------------------------------------
function initCountdown() {
  function update() {
    const diff      = new Date(EVENT.datetimeISO) - new Date();
    const container = document.getElementById('countdown');

    if (diff <= 0) {
      container.innerHTML = '<div class="countdown-ended">L\'événement a commencé !</div>';
      return;
    }

    const pad = n => String(Math.floor(n)).padStart(2, '0');
    container.innerHTML = `
      <div class="countdown-item">
        <div class="countdown-number">${pad(diff / 86400000)}</div>
        <div class="countdown-unit">Jours</div>
      </div>
      <div class="countdown-separator">:</div>
      <div class="countdown-item">
        <div class="countdown-number">${pad((diff / 3600000) % 24)}</div>
        <div class="countdown-unit">Heures</div>
      </div>
      <div class="countdown-separator">:</div>
      <div class="countdown-item">
        <div class="countdown-number">${pad((diff / 60000) % 60)}</div>
        <div class="countdown-unit">Minutes</div>
      </div>
      <div class="countdown-separator">:</div>
      <div class="countdown-item">
        <div class="countdown-number">${pad((diff / 1000) % 60)}</div>
        <div class="countdown-unit">Secondes</div>
      </div>
    `;
  }

  update();
  setInterval(update, 1000);
}

// ---------------------------------------------------------------
// SCROLL REVEAL
// ---------------------------------------------------------------
function initScrollReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.15 });

  // Délai 0 pour attendre le rendu du programme
  setTimeout(() => {
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
  }, 0);
}

// ---------------------------------------------------------------
// CAPACITÉ
// ---------------------------------------------------------------
async function initCapacityCheck() {
  try {
    const r    = await fetch(`${EVENT.apiUrl}?action=list`);
    const data = await r.json();
    if (data.status !== 'success') return;

    const remaining = EVENT.maxCapacity - data.data.length;
    const el        = document.getElementById('places-restantes');

    if (remaining <= 0) {
      el.innerHTML = '<strong style="color:#c94c4c;">Complet — Plus de places disponibles</strong>';
      document.getElementById('submitBtn').disabled    = true;
      document.getElementById('submitBtn').textContent = 'Complet';
    } else {
      el.textContent =
        `${remaining} place${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''} sur ${EVENT.maxCapacity}`;
    }
  } catch (_) { /* silencieux — ne bloque pas l'affichage */ }
}

// ---------------------------------------------------------------
// FORMULAIRE D'INSCRIPTION
// ---------------------------------------------------------------
function initForm() {
  document.getElementById('regForm').addEventListener('submit', handleSubmit);
}

async function handleSubmit(e) {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const gender   = document.getElementById('gender').value;
  const phone    = document.getElementById('phone').value.trim();
  const church   = document.getElementById('church').value.trim();
  const email    = document.getElementById('email').value.trim();
  const submitBtn = document.getElementById('submitBtn');

  if (!fullName || !gender || !phone || !church) {
    showStatus('Veuillez remplir tous les champs obligatoires.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Inscription en cours...';
  document.getElementById('form-status').innerHTML = '';

  const ticketId  = generateTicketId();
  const timestamp = new Date().toLocaleString('fr-FR', { timeZone: EVENT.timezone });
  const formData  = {
    full_name: fullName, gender, phone, church,
    email:     email || 'N/A',
    ticket_id: ticketId,
    timestamp,
  };

  try {
    const params     = new URLSearchParams({ action: 'register', ...formData });
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 8000);
    const response   = await fetch(`${EVENT.apiUrl}?${params}`, { signal: controller.signal });
    clearTimeout(timeout);
    const result = await response.json();

    if (result.status === 'full') {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Réserver ma Place';
      showStatus(`Toutes les ${EVENT.maxCapacity} places sont prises !`, 'error');
      document.getElementById('places-restantes').innerHTML =
        '<strong style="color:#c94c4c;">Complet — Plus de places disponibles</strong>';
      return;
    }

    if (result.status === 'error') {
      submitBtn.disabled    = false;
      submitBtn.textContent = 'Réserver ma Place';
      showStatus(result.message || 'Une erreur est survenue.', 'error');
      return;
    }
  } catch (_) {
    // Timeout ou réseau — le ticket est quand même généré
  }

  showTicket(formData);
}

function showStatus(msg, type) {
  document.getElementById('form-status').innerHTML =
    `<div class="status-msg ${type}">${msg}</div>`;
}

function generateTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = EVENT.ticketPrefix;
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ---------------------------------------------------------------
// AFFICHAGE DU TICKET + QR CODE
// ---------------------------------------------------------------
function showTicket(data) {
  document.getElementById('form-container').style.display = 'none';
  const confirmation = document.getElementById('confirmation');
  confirmation.style.display = 'block';

  new QRious({
    element:         document.getElementById('qrcodeCanvas'),
    value:           JSON.stringify({ id: data.ticket_id, name: data.full_name, event: EVENT.fullTitle }),
    size:            180,
    backgroundAlpha: 1,
    background:      '#ffffff',
    foreground:      '#0a1628',
    level:           'M',
  });

  document.getElementById('ticketDetails').innerHTML = `
    <div class="ticket-detail-row">
      <span class="ticket-detail-label">Nom</span>
      <span class="ticket-detail-value">${data.full_name}</span>
    </div>
    <div class="ticket-detail-row">
      <span class="ticket-detail-label">Téléphone</span>
      <span class="ticket-detail-value">${data.phone}</span>
    </div>
    <div class="ticket-detail-row">
      <span class="ticket-detail-label">Église</span>
      <span class="ticket-detail-value">${data.church}</span>
    </div>
    <div class="ticket-detail-row">
      <span class="ticket-detail-label">Lieu</span>
      <span class="ticket-detail-value">${EVENT.venue}</span>
    </div>
  `;
  document.getElementById('ticketId').textContent = data.ticket_id;
  confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function downloadTicket() {
  const btn = document.getElementById('downloadTicketBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Génération...';

  html2canvas(document.getElementById('ticket-card'), {
    backgroundColor: '#0f1f3d',
    scale:           2,
    useCORS:         true,
    logging:         false,
  }).then(canvas => {
    const link      = document.createElement('a');
    link.download   = `ticket-${document.getElementById('ticketId').textContent}.png`;
    link.href       = canvas.toDataURL('image/png');
    link.click();
    btn.disabled    = false;
    btn.textContent = 'Télécharger mon Ticket';
  }).catch(() => {
    btn.disabled    = false;
    btn.textContent = 'Télécharger mon Ticket';
  });
}

function resetForm() {
  document.getElementById('form-container').style.display = 'block';
  document.getElementById('confirmation').style.display   = 'none';
  document.getElementById('regForm').reset();

  const submitBtn       = document.getElementById('submitBtn');
  submitBtn.disabled    = false;
  submitBtn.textContent = 'Réserver ma Place';
  document.getElementById('form-status').innerHTML = '';
  document.getElementById('inscription').scrollIntoView({ behavior: 'smooth' });
}
