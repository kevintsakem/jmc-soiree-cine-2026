// =================================================================
// SERVER.JS — Serveur local de développement
// Usage : npm run dev
// =================================================================
const express  = require('express');
const path     = require('path');
const cors     = require('cors');
const { initDB }                                                       = require('./api/db');
const { handleAuth, handleRegister, handleScan, handleList, handleDelete, handleExport } = require('./api/handlers');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // Sert HTML, JS, etc.

app.get('/api', async (req, res) => {
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

initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✅ Serveur JMC démarré sur http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ Erreur DB:', err.message);
    process.exit(1);
  });
