import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';


const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorMiddleware);

export default app;