import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const getGeminiModel = () => {
  return genAI.getGenerativeModel({
    model: process.env.AI_MODEL || 'gemini-1.5-flash',
  });
};

