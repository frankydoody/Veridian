import express from 'express';
import helmet from 'helmet';
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
import calendarRoutes from './src/routes/calendar.routes.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';
import { maxAudioBytes } from './src/middlewares/upload.middleware.js';
import { corsMiddleware, createAuthLimiter } from './src/config/security.js';

const app = express();

// ─── Sécurité (bloc 17) ──────────────────────────────────────────────────────
// En-têtes de sécurité (nosniff, interdiction d'affichage dans un cadre, etc.) et retrait de
// « X-Powered-By: Express », qui annonce la technologie du serveur.
// « same-site » : le frontend (localhost:5173) peut lire l'audio et le PDF du backend (localhost:3000).
app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));

// CORS : seules les origines de FRONTEND_URL (par défaut http://localhost:5173)
app.use(corsMiddleware());

// Limitation de débit : empêche d'essayer des mots de passe en rafale (AUTH_RATE_LIMIT).
// Placée avant la lecture du corps : une requête refusée n'est même pas analysée.
const authLimiter = createAuthLimiter();
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

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
app.use('/api/calendar', calendarRoutes);

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
