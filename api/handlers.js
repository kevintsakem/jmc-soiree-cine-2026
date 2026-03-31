// =================================================================
// HANDLERS.JS — Logique métier de chaque action API
// =================================================================
const XLSX                    = require('xlsx');
const { pool }                = require('./db');
const { MAX_PLACES, LOCALE, TIMEZONE } = require('./config');

// ---------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------
function now() {
  return new Date().toLocaleString(LOCALE, { timeZone: TIMEZONE });
}

function sanitize(val) {
  return (val || '').toString().trim().replace(/[<>"']/g, '');
}

// ---------------------------------------------------------------
// AUTH — vérification identifiants admin (credentials dans .env)
// ---------------------------------------------------------------
async function handleAuth(params, res) {
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'jmc2026';

  if (sanitize(params.username) === validUser && params.password === validPass) {
    return res.json({ status: 'success' });
  }
  return res.status(401).json({ status: 'error', message: 'Identifiants incorrects.' });
}

// ---------------------------------------------------------------
// REGISTER — nouvelle inscription
// ---------------------------------------------------------------
async function handleRegister(params, res) {
  const full_name = sanitize(params.full_name);
  const gender    = sanitize(params.gender);
  const phone     = sanitize(params.phone);
  const church    = sanitize(params.church);
  const email     = sanitize(params.email) || 'N/A';
  const ticket_id = sanitize(params.ticket_id);
  const timestamp = sanitize(params.timestamp) || now();

  if (!full_name || !ticket_id) {
    return res.json({ status: 'error', message: 'Champs obligatoires manquants.' });
  }

  const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM inscriptions');
  if (parseInt(count) >= MAX_PLACES) {
    return res.json({ status: 'full', message: 'Toutes les places sont prises !' });
  }

  try {
    await pool.query(
      `INSERT INTO inscriptions
         (timestamp, full_name, gender, phone, church, email, ticket_id, scan_status, scan_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Non scanné', '')`,
      [timestamp, full_name, gender, phone, church, email, ticket_id]
    );
    return res.json({ status: 'success', message: 'Inscription enregistrée.', ticket_id });
  } catch (err) {
    if (err.code === '23505')
      return res.json({ status: 'error', message: 'Ce ticket ID existe déjà.' });
    throw err;
  }
}

// ---------------------------------------------------------------
// SCAN — validation d'un ticket à l'entrée
// ---------------------------------------------------------------
async function handleScan(ticketId, res) {
  if (!ticketId)
    return res.json({ status: 'error', message: 'ticket_id manquant.' });

  const { rows } = await pool.query(
    'SELECT * FROM inscriptions WHERE ticket_id = $1',
    [sanitize(ticketId)]
  );

  if (!rows.length)
    return res.json({ status: 'not_found', message: 'Aucun inscrit trouvé avec ce ticket.' });

  const row   = rows[0];
  const guest = {
    full_name:   row.full_name,
    gender:      row.gender,
    phone:       row.phone,
    church:      row.church,
    email:       row.email,
    ticket_id:   row.ticket_id,
    scan_status: row.scan_status,
    scanned_at:  row.scan_time || null,
  };

  if (row.scan_status === 'Scanné')
    return res.json({ status: 'already_scanned', message: 'Ce ticket a déjà été scanné.', data: guest });

  const scanTime = now();
  await pool.query(
    'UPDATE inscriptions SET scan_status = $1, scan_time = $2 WHERE ticket_id = $3',
    ['Scanné', scanTime, row.ticket_id]
  );

  guest.scan_status = 'Scanné';
  guest.scanned_at  = scanTime;
  return res.json({ status: 'success', message: 'Ticket scanné avec succès !', data: guest });
}

// ---------------------------------------------------------------
// LIST — liste de tous les inscrits
// ---------------------------------------------------------------
async function handleList(res) {
  const { rows } = await pool.query('SELECT * FROM inscriptions ORDER BY id ASC');
  return res.json({
    status: 'success',
    data:   rows.map(r => ({
      timestamp:   r.timestamp,
      full_name:   r.full_name,
      gender:      r.gender,
      phone:       r.phone,
      church:      r.church,
      email:       r.email,
      ticket_id:   r.ticket_id,
      scan_status: r.scan_status || 'Non scanné',
      scanned_at:  r.scan_time  || null,
    })),
  });
}

// ---------------------------------------------------------------
// DELETE — suppression d'un inscrit
// ---------------------------------------------------------------
async function handleDelete(ticketId, res) {
  if (!ticketId)
    return res.json({ status: 'error', message: 'ticket_id manquant.' });

  const result = await pool.query(
    'DELETE FROM inscriptions WHERE ticket_id = $1',
    [sanitize(ticketId)]
  );

  if (result.rowCount === 0)
    return res.json({ status: 'error', message: 'Ticket introuvable.' });

  return res.json({ status: 'success', message: 'Inscription supprimée.' });
}

// ---------------------------------------------------------------
// EXPORT — téléchargement Excel
// ---------------------------------------------------------------
async function handleExport(res) {
  const { rows } = await pool.query('SELECT * FROM inscriptions ORDER BY id ASC');

  const wsData = [
    ['Timestamp', 'Nom Complet', 'Sexe', 'Téléphone', 'Église', 'Email', 'Ticket ID', 'Statut Scan', 'Heure Scan'],
    ...rows.map(r => [
      r.timestamp, r.full_name, r.gender, r.phone,
      r.church, r.email, r.ticket_id, r.scan_status, r.scan_time,
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [
    { wch: 20 }, { wch: 28 }, { wch: 10 }, { wch: 16 },
    { wch: 22 }, { wch: 26 }, { wch: 20 }, { wch: 14 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Inscriptions');

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const date   = new Date().toISOString().split('T')[0];

  res.setHeader('Content-Disposition', `attachment; filename="inscriptions-${date}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

module.exports = { handleAuth, handleRegister, handleScan, handleList, handleDelete, handleExport };
