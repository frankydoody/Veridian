import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import projectRoutes from './src/routes/project.routes.js';
import meetingRoutes from './src/routes/meeting.routes.js';
import transcriptionRoutes from './src/routes/transcription.routes.js';
import decisionRoutes from './src/routes/decision.routes.js';
import memoryRoutes from './src/routes/memory.routes.js';
import taskRoutes from './src/routes/task.routes.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Autorise le frontend (Vite sur :5173) à appeler le backend (:3000)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/transcriptions', transcriptionRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/tasks', taskRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorMiddleware);

export default app;
