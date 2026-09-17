import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const FALLBACK_MODELS = [
  process.env.AI_MODEL || 'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.1-flash-lite',
];

export const getGeminiModel = () => {
  return genAI.getGenerativeModel({
    model: FALLBACK_MODELS[0],
  });
};

export const generateWithFallback = async (prompt) => {
  let lastError;

  for (const modelName of FALLBACK_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      
      if (modelName !== FALLBACK_MODELS[0]) {
        console.log(`⚠️ Modèle de secours utilisé : ${modelName}`);
      }
      
      return result.response.text();
    } catch (error) {
      const isRetryable = 
        error.message?.includes('503') ||
        error.message?.includes('overloaded') ||
        error.message?.includes('high demand') ||
        error.message?.includes('404') ||
        error.message?.includes('not found');

      if (isRetryable) {
        console.log(`⚠️ Modèle ${modelName} indisponible, tentative suivante...`);
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Tous les modèles Gemini sont indisponibles. Dernière erreur: ${lastError.message}`);
};