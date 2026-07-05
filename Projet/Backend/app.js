import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import { authMiddleware } from './src/middlewares/auth.middleware.js';

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/protected', authMiddleware, (req, res) => {
  res.json({
    message: 'Accès autorisé',
    user: req.user
  });
});

export default app;