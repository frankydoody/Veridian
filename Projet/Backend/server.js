import 'dotenv/config';
import app from './app.js';
import { testConnection } from './src/config/db.js';
import { resetInterruptedProcessing } from './src/models/processing.model.js';

const PORT = process.env.PORT || 3000;

const startServer = async () => {
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
  });
};

startServer();