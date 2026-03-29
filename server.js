// =============================================
// SERVEUR JMC SOIRÉE CINÉMA 2026
// Node.js + Express + SQLite + Export Excel
// =============================================
//
// DÉMARRAGE :
//   npm install
//   npm start
//
// Accès local  : http://localhost:3000
// Accès réseau : http://<IP-du-serveur>:3000
//
// DÉPLOIEMENT (Railway / Render / Fly.io) :
//   - Pousse ce dossier sur GitHub
//   - Connecte le repo sur railway.app ou render.com
//   - Le serveur démarre automatiquement avec npm start
// =============================================

const express = require('express');
const XLSX = require('xlsx');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// BASE DE DONNÉES — fichier JSON
// =============================================
const DB_FILE = path.join(__dirname, 'inscriptions.json');

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return []; }
}

function saveDB(records) {
  fs.writeFileSync(DB_FILE, JSON.stringify(records, null, 2), 'utf8');
}

// =============================================
// MIDDLEWARES
// =============================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// =============================================
// API — compatible avec l'ancien Google Apps Script
// Tous les appels passent par GET /api?action=...
// =============================================
app.get('/api', (req, res) => {
  const action = (req.query.action || '').toLowerCase();

  try {
    if (action === 'register') {
      return handleRegister(req.query, res);
    } else if (action === 'scan') {
      return handleScan(req.query.ticket_id, res);
    } else if (action === 'list') {
      return handleList(res);
    } else if (action === 'export') {
      return handleExport(res);
    } else {
      return res.json({ status: 'ok', message: 'JMC Soirée Cinéma API v3. Actions: register, scan, list, export' });
    }
  } catch (err) {
    console.error('API error:', err);
    return res.json({ status: 'error', message: err.toString() });
  }
});

// =============================================
// REGISTER — Nouvelle inscription
// =============================================
function handleRegister(params, res) {
  const records = loadDB();

  if (records.find(r => r.ticket_id === params.ticket_id)) {
    return res.json({ status: 'error', message: 'Ce ticket ID existe déjà.' });
  }

  records.push({
    timestamp:   params.timestamp || new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }),
    full_name:   params.full_name || '',
    gender:      params.gender || '',
    phone:       params.phone || '',
    church:      params.church || '',
    email:       params.email || 'N/A',
    ticket_id:   params.ticket_id || '',
    scan_status: 'Non scanné',
    scan_time:   ''
  });

  saveDB(records);
  return res.json({ status: 'success', message: 'Inscription enregistrée', ticket_id: params.ticket_id });
}

// =============================================
// SCAN — Vérifier et valider un ticket
// =============================================
function handleScan(ticketId, res) {
  if (!ticketId) {
    return res.json({ status: 'error', message: 'ticket_id manquant' });
  }

  const records = loadDB();
  const row = records.find(r => r.ticket_id === ticketId);

  if (!row) {
    return res.json({ status: 'not_found', message: 'Aucun inscrit trouvé avec ce ticket ID.' });
  }

  const guestData = {
    full_name:   row.full_name,
    gender:      row.gender,
    phone:       row.phone,
    church:      row.church,
    email:       row.email,
    ticket_id:   row.ticket_id,
    scan_status: row.scan_status,
    scanned_at:  row.scan_time || null
  };

  if (row.scan_status === 'Scanné') {
    return res.json({ status: 'already_scanned', message: 'Ce ticket a déjà été scanné.', data: guestData });
  }

  const scanTime = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
  row.scan_status = 'Scanné';
  row.scan_time   = scanTime;
  saveDB(records);

  guestData.scan_status = 'Scanné';
  guestData.scanned_at  = scanTime;

  return res.json({ status: 'success', message: 'Ticket scanné avec succès !', data: guestData });
}

// =============================================
// LIST — Retourner tous les inscrits
// =============================================
function handleList(res) {
  const records = loadDB();
  const guests = records.map(row => ({
    timestamp:   row.timestamp,
    full_name:   row.full_name,
    gender:      row.gender,
    phone:       row.phone,
    church:      row.church,
    email:       row.email,
    ticket_id:   row.ticket_id,
    scan_status: row.scan_status || 'Non scanné',
    scanned_at:  row.scan_time || null
  }));
  return res.json({ status: 'success', data: guests });
}

// =============================================
// EXPORT — Télécharger le fichier Excel
// =============================================
function handleExport(res) {
  const rows = loadDB();

  const wsData = [
    ['Timestamp', 'Nom Complet', 'Sexe', 'Téléphone', 'Église', 'Email', 'Ticket ID', 'Statut Scan', 'Heure Scan'],
    ...rows.map(row => [
      row.timestamp,
      row.full_name,
      row.gender,
      row.phone,
      row.church,
      row.email,
      row.ticket_id,
      row.scan_status,
      row.scan_time
    ])
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Largeur des colonnes
  ws['!cols'] = [
    { wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 16 },
    { wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 20 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Inscriptions');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const filename = `inscriptions-JMC-${new Date().toISOString().split('T')[0]}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

// =============================================
// DÉMARRAGE
// =============================================
app.listen(PORT, () => {
  console.log('');
  console.log('✅ Serveur JMC Soirée Cinéma démarré');
  console.log(`   Local   : http://localhost:${PORT}`);
  console.log(`   Réseau  : http://<votre-IP>:${PORT}`);
  console.log('');
});
