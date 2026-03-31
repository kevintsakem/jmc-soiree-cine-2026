// =================================================================
// CONFIG ÉVÉNEMENT — seul fichier à modifier pour un nouvel événement
// =================================================================
const EVENT = {
  // Identité
  orgName:      'JMC',
  eventName:    'Soirée Cinéma',
  fullTitle:    'JMC — Soirée Cinéma',
  year:         '2026',

  // Date & lieu
  date:         '12 Avril 2026',
  time:         '15h30',
  datetimeISO:  '2026-04-12T15:30:00+01:00', // WAT = UTC+1
  timezone:     'Africa/Douala',
  venue:        "Salle de l'Auditorium",
  freeEntry:    true,

  // Inscriptions
  maxCapacity:  100,
  ticketPrefix: 'JMC-CIN-',

  // API
  apiUrl: '/api',

  // Programme [ { time, title, desc } ]
  programme: [
    {
      time:  '15h30',
      title: 'Accueil & Installation',
      desc:  'Arrivée des invités, installation dans la salle et ambiance musicale.',
    },
    {
      time:  '16h00',
      title: 'Mot de Bienvenue',
      desc:  'Ouverture officielle de la soirée cinéma par les responsables JMC.',
    },
    {
      time:  '16h15',
      title: 'Projection du Film',
      desc:  "Diffusion du film sélectionné — un moment de partage et de réflexion.",
    },
    {
      time:  '18h00',
      title: 'Discussion & Échanges',
      desc:  "Débat ouvert sur les thèmes du film, partage d'impressions et de réflexions.",
    },
    {
      time:  '18h30',
      title: 'Collation & Clôture',
      desc:  "Moment convivial autour d'une collation, photos et clôture de la soirée.",
    },
  ],
};
