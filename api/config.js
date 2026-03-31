// =================================================================
// CONFIG SERVEUR — modifiable via variables d'environnement Vercel/Render
// =================================================================
module.exports = {
  MAX_PLACES:    parseInt(process.env.MAX_PLACES) || 100,
  EVENT_NAME:    process.env.EVENT_NAME           || 'JMC Soirée Cinéma 2026',
  TIMEZONE:      'Africa/Douala',
  LOCALE:        'fr-FR',
  TICKET_PREFIX: 'JMC-CIN-',
};
