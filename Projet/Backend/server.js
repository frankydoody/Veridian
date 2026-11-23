import 'dotenv/config';
import app from './app.js';
import { testConnection } from './src/config/db.js';
import { resetInterruptedProcessing } from './src/models/processing.model.js';
import { checkSecurityConfig } from './src/config/security.js';
import { startupNotices } from './src/services/verification.service.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  // Bloc 17 : pas de démarrage avec une configuration dangereuse (secret JWT vide ou trop court)
  const problems = checkSecurityConfig();
  if (problems.length) {
    problems.forEach((problem) => console.error(`❌ ${problem}`));
    process.exit(1);
  }

  await testConnection();

  // Bloc 20 : un traitement « en cours » au démarrage a été interrompu par l'arrêt précédent
  try {
    const reset = await resetInterruptedProcessing();
    if (reset.transcriptions || reset.analyses) {
      console.warn(`⚠️ Traitements interrompus remis en erreur : ${reset.transcriptions} transcription(s), ${reset.analyses} analyse(s).`);
    }
  } catch (error) {
    console.error('Remise à zéro des traitements interrompus impossible :', error.message);
  }
  
  app.listen(PORT, () => {
    console.log(`🚀 Serveur Veridian démarré sur http://localhost:${PORT}`);
    // Bloc 18 : modes dégradés annoncés dès le démarrage
    startupNotices().forEach((notice) => console.log(notice));
  });
};

startServer();