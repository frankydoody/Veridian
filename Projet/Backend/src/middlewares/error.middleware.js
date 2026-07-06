export const errorMiddleware = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.url} →`, err.message);

  const status = err.status || 500;

  const message = err.status
    ? err.message
    : 'Erreur interne du serveur';

  return res.status(status).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};



