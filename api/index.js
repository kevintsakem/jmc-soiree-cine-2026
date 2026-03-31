const express  = require('express');
const { Pool } = require('pg');
const XLSX     = require('xlsx');
const cors     = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Crée les tables si absentes
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inscriptions (
      id          SERIAL PRIMARY KEY,
      timestamp   TEXT,
      full_name   TEXT NOT NULL,
      gender      TEXT,
      phone       TEXT,
      church      TEXT,
      email       TEXT DEFAULT 'N/A',
      ticket_id   TEXT UNIQUE NOT NULL,
      scan_status TEXT DEFAULT 'Non scanné',
      scan_time   TEXT DEFAULT ''
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  await pool.query(`
    INSERT INTO settings (key, value) VALUES ('max_places', '100')
    ON CONFLICT (key) DO NOTHING
  `);
}
initDB().catch(console.error);

app.get(['/', '/api'], async (req, res) => {
  const action = (req.query.action || '').toLowerCase();
  try {
    if (action === 'register')     return await handleRegister(req.query, res);
    if (action === 'scan')         return await handleScan(req.query.ticket_id, res);
    if (action === 'list')         return await handleList(res);
    if (action === 'delete')       return await handleDelete(req.query.ticket_id, res);
    if (action === 'deletemany')   return await handleDeleteMany(req.query.ticket_ids, res);
    if (action === 'export')       return await handleExport(res);
    if (action === 'getcapacity')  return await handleGetCapacity(res);
    if (action === 'setcapacity')  return await handleSetCapacity(req.query.value, res);
    return res.json({ status: 'ok', message: 'JMC Soirée Cinéma API v3' });
  } catch (err) {
    return res.json({ status: 'error', message: err.toString() });
  }
});

async function getMaxPlaces() {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key='max_places'");
  return rows.length ? parseInt(rows[0].value) : 100;
}

async function handleGetCapacity(res) {
  const max = await getMaxPlaces();
  const { rows } = await pool.query('SELECT COUNT(*) FROM inscriptions');
  return res.json({ status: 'success', max_places: max, current: parseInt(rows[0].count) });
}

async function handleSetCapacity(value, res) {
  const n = parseInt(value);
  if (!value || isNaN(n) || n < 1) {
    return res.json({ status: 'error', message: 'Valeur invalide.' });
  }
  await pool.query("UPDATE settings SET value=$1 WHERE key='max_places'", [String(n)]);
  return res.json({ status: 'success', message: `Capacité mise à jour : ${n} places.`, max_places: n });
}

async function handleRegister(params, res) {
  const timestamp = params.timestamp ||
    new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });

  // Vérifier la capacité (lue depuis la base)
  const maxPlaces = await getMaxPlaces();
  const { rows: countRows } = await pool.query('SELECT COUNT(*) FROM inscriptions');
  if (parseInt(countRows[0].count) >= maxPlaces) {
    return res.json({ status: 'full', message: 'Désolé, toutes les places sont prises !' });
  }

  try {
    await pool.query(
      `INSERT INTO inscriptions (timestamp,full_name,gender,phone,church,email,ticket_id,scan_status,scan_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Non scanné','')`,
      [timestamp, params.full_name||'', params.gender||'', params.phone||'',
       params.church||'', params.email||'N/A', params.ticket_id||'']
    );
    return res.json({ status:'success', message:'Inscription enregistrée', ticket_id: params.ticket_id });
  } catch (err) {
    if (err.code === '23505') return res.json({ status:'error', message:'Ce ticket ID existe déjà.' });
    throw err;
  }
}

async function handleScan(ticketId, res) {
  if (!ticketId) return res.json({ status:'error', message:'ticket_id manquant' });
  const { rows } = await pool.query('SELECT * FROM inscriptions WHERE ticket_id=$1', [ticketId]);
  if (!rows.length) return res.json({ status:'not_found', message:'Aucun inscrit trouvé.' });
  const row = rows[0];
  const guest = {
    full_name: row.full_name, gender: row.gender, phone: row.phone,
    church: row.church, email: row.email, ticket_id: row.ticket_id,
    scan_status: row.scan_status, scanned_at: row.scan_time || null
  };
  if (row.scan_status === 'Scanné') {
    return res.json({ status:'already_scanned', message:'Ce ticket a déjà été scanné.', data: guest });
  }
  const scanTime = new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Douala' });
  await pool.query('UPDATE inscriptions SET scan_status=$1,scan_time=$2 WHERE ticket_id=$3',
    ['Scanné', scanTime, ticketId]);
  guest.scan_status = 'Scanné';
  guest.scanned_at  = scanTime;
  return res.json({ status:'success', message:'Ticket scanné avec succès !', data: guest });
}

async function handleList(res) {
  const { rows } = await pool.query('SELECT * FROM inscriptions ORDER BY id ASC');
  return res.json({ status:'success', data: rows.map(r => ({
    timestamp: r.timestamp, full_name: r.full_name, gender: r.gender,
    phone: r.phone, church: r.church, email: r.email, ticket_id: r.ticket_id,
    scan_status: r.scan_status || 'Non scanné', scanned_at: r.scan_time || null
  }))});
}

async function handleDelete(ticketId, res) {
  if (!ticketId) return res.json({ status:'error', message:'ticket_id manquant' });
  const result = await pool.query('DELETE FROM inscriptions WHERE ticket_id=$1', [ticketId]);
  if (result.rowCount === 0) return res.json({ status:'error', message:'Ticket introuvable.' });
  return res.json({ status:'success', message:'Inscription supprimée.' });
}

async function handleDeleteMany(ticketIds, res) {
  if (!ticketIds) return res.json({ status:'error', message:'ticket_ids manquant' });
  const ids = ticketIds.split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length === 0) return res.json({ status:'error', message:'Aucun ticket fourni.' });
  const result = await pool.query(
    'DELETE FROM inscriptions WHERE ticket_id = ANY($1::text[])', [ids]
  );
  return res.json({ status:'success', message:`${result.rowCount} inscription(s) supprimée(s).`, deleted: result.rowCount });
}

async function handleExport(res) {
  const { rows } = await pool.query('SELECT * FROM inscriptions ORDER BY id ASC');
  const wsData = [
    ['Timestamp','Nom Complet','Sexe','Téléphone','Église','Email','Ticket ID','Statut Scan','Heure Scan'],
    ...rows.map(r => [r.timestamp,r.full_name,r.gender,r.phone,r.church,r.email,r.ticket_id,r.scan_status,r.scan_time])
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{wch:20},{wch:28},{wch:10},{wch:16},{wch:22},{wch:26},{wch:20},{wch:14},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, 'Inscriptions');
  const buffer = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
  res.setHeader('Content-Disposition', `attachment; filename="inscriptions-JMC-${new Date().toISOString().split('T')[0]}.xlsx"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
}

module.exports = app;
