// Gestionnaire d'erreurs final de l'API.
// Bloc 17 : le client ne reçoit jamais de trace d'exécution, sauf en développement explicite
// (NODE_ENV=development) ; le détail complet reste dans la console du serveur.
export const errorMiddleware = (err, req, res, next) => {
  // Corps JSON mal formé ou trop gros (express.json) : erreur du client, message clair
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Corps de requête JSON invalide' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Requête trop volumineuse' });
  }
  // Filet de sécurité : valeur mal formée refusée par PostgreSQL (ex. un UUID invalide, code 22P02).
  // Les contrôleurs valident déjà leurs identifiants ; un oubli donne quand même 400, pas 500.
  if (err.code === '22P02') {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} → valeur invalide :`, err.message);
    return res.status(400).json({ message: 'Identifiant ou valeur invalide' });
  }

  const status = err.status || err.statusCode || 500;

  // Erreur serveur : trace complète dans la console pour pouvoir corriger
  console.error(`[ERROR] ${req.method} ${req.originalUrl} →`, status >= 500 ? (err.stack || err.message) : err.message);

  // Un message d'erreur interne (SQL, chemin de fichier…) n'est jamais montré au client
  const message = status < 500 && err.message ? err.message : 'Erreur interne du serveur';

  return res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
