import express from 'express';
import authRoutes from './src/routes/auth.routes.js';
import projectRoutes from './src/routes/project.routes.js';
import meetingRoutes from './src/routes/meeting.routes.js';
import transcriptionRoutes from './src/routes/transcription.routes.js';
import { errorMiddleware } from './src/middlewares/error.middleware.js';

const app = express();

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/transcriptions', transcriptionRoutes);


app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(errorMiddleware);

export default app;