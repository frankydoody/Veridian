import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import projectRoutes from './src/routes/project.routes.js';
import meetingRoutes from './src/routes/meeting.routes.js';
import transcriptionRoutes from './src/routes/transcription.routes.js';
import decisionRoutes from './src/routes/decision.routes.js';
import memoryRoutes from './src/routes/memory.routes.js';
import taskRoutes from './src/routes/task.routes.js';
import alertRoutes from './src/routes/alert.routes.js';
import chatRoutes from './src/routes/chat.routes.js';
import dashboardRoutes from './src/routes/dashboard.routes.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';
import { maxAudioBytes } from './src/middlewares/upload.middleware.js';

const app = express();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Autorise le frontend (Vite sur :5173) à appeler le backend (:3000)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  // Le frontend lit le nom du fichier PDF dans Content-Disposition
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// 1 Mo : une transcription collée d'une longue réunion dépasse la limite par défaut (100 Ko)
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/transcriptions', transcriptionRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/dashboard', dashboardRoutes);

// État du serveur et des services configurés. Ne renvoie que des indicateurs, JAMAIS de secret.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    services: {
      ai: Boolean(process.env.GEMINI_API_KEY),
      email: process.env.SMTP_HOST ? 'smtp' : 'console',
    },
    // Le navigateur refuse un fichier trop gros AVANT de l'envoyer
    limits: { audioMb: Math.round(maxAudioBytes() / 1024 / 1024) },
  });
});

app.use(errorMiddleware);

export default app;
