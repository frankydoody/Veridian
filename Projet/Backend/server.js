import 'dotenv/config';
import app from './app.js';
import { testConnection } from './src/config/db.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await testConnection();
  
  app.listen(PORT, () => {
    console.log(`🚀 Serveur Veridian démarré sur http://localhost:${PORT}`);
  });
};

startServer();