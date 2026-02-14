export const connectionConfig = {
  // Badge text
  connectedText: '● Connecté',
  offlineText: '● Hors-ligne',

  // Tooltip messages
  tooltipOnline: 'Connecté',
  tooltipOffline: 'Hors-ligne - Vérifiez votre connexion internet pour enregistrer les données.',
  tooltipServerIssue: 'Problème de connexion au serveur Supabase. Vérifiez l\'accès réseau.',

  // Tailwind-like classes for styling the badge (customize as needed)
  onlineBadgeClasses: 'bg-green-100 text-green-800',
  offlineBadgeClasses: 'bg-amber-100 text-amber-800',
  onlineDotClasses: 'bg-green-600',
  offlineDotClasses: 'bg-amber-600',

  // Heartbeat interval (ms)
  heartbeatInterval: 30000,
  // Heartbeat timeout (ms)
  heartbeatTimeout: 4000,
};
