// =================================================================
// API/INDEX.JS — Point d'entrée Vercel (routing uniquement)
// =================================================================
const express  = require('express');
const cors     = require('cors');
const { initDB }                                                       = require('./db');
const { handleAuth, handleRegister, handleScan, handleList, handleDelete, handleExport } = require('./handlers');

const app = express();
app.use(cors());
app.use(express.json());

initDB().catch(console.error);

app.get(['/', '/api'], async (req, res) => {
  const action = (req.query.action || '').toLowerCase();

  try {
    switch (action) {
      case 'auth':     return await handleAuth(req.query, res);
      case 'register': return await handleRegister(req.query, res);
      case 'scan':     return await handleScan(req.query.ticket_id, res);
      case 'list':     return await handleList(res);
      case 'delete':   return await handleDelete(req.query.ticket_id, res);
      case 'export':   return await handleExport(res);
      default:         return res.json({ status: 'ok', message: 'JMC Events API v1' });
    }
  } catch (err) {
    console.error('API error:', err);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
});

module.exports = app;
