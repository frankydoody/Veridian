import { getGeminiModel } from '../config/gemini.js';

export const extractDecisions = async (transcription) => {
  const model = getGeminiModel();

  const prompt = `Tu es un assistant spécialisé dans l'analyse de réunions d'entreprise.

Analyse la transcription suivante et extrais toutes les décisions prises.

Pour chaque décision, retourne un objet JSON avec exactement ces champs :
- content : la décision prise (phrase claire et concise)
- context : le contexte ou la justification de cette décision
- responsible : la personne responsable (null si non mentionnée)
- alternatives : tableau des alternatives considérées et rejetées (tableau vide si aucune)
- confidence : niveau de confiance dans l'extraction (0 à 100)

Retourne UNIQUEMENT un tableau JSON valide, sans texte avant ou après.
Si aucune décision n'est trouvée, retourne un tableau vide [].

TRANSCRIPTION :
${transcription}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  return JSON.parse(cleanText);
};


export const detectContradiction = async (newDecision, pastDecisions) => {
  if (pastDecisions.length === 0) return null;

  const model = getGeminiModel();

  const prompt = `Tu es un expert en analyse de cohérence décisionnelle.

Nouvelle décision :
"${newDecision.content}"

Décisions passées du même projet :
${pastDecisions.map((d, i) => `${i + 1}. "${d.content}"`).join('\n')}

Analyse si la nouvelle décision contredit une ou plusieurs décisions passées.
Une contradiction existe quand deux décisions sont incompatibles ou s'excluent mutuellement.

Retourne UNIQUEMENT un objet JSON avec ces champs :
- hasContradiction : true ou false
- conflictIndex : l'index (1-based) de la décision en conflit, null si aucun
- severity : "low", "medium" ou "high", null si aucune contradiction
- explanation : explication claire de la contradiction, null si aucune

Retourne UNIQUEMENT l'objet JSON, sans texte avant ou après.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const analysis = JSON.parse(cleanText);

  if (!analysis.hasContradiction) return null;

  return {
    conflictDecision: pastDecisions[analysis.conflictIndex - 1],
    severity: analysis.severity,
    explanation: analysis.explanation,
  };
};


export const chatWithMemory = async (question, relevantDecisions) => {
  const model = getGeminiModel();

  const context = relevantDecisions
    .map((d, i) => `Décision ${i + 1} (réunion du ${new Date(d.created_at).toLocaleDateString('fr-CA')}) :
    - Décision : ${d.content}
    - Contexte : ${d.context || 'Non précisé'}`)
    .join('\n\n');

  const prompt = `Tu es l'assistant mémoire organisationnelle de Veridian.
Tu aides les équipes à retrouver et comprendre les décisions passées de leur projet.

Voici les décisions pertinentes trouvées dans l'historique du projet :

${context}

Question de l'utilisateur : ${question}

Réponds de façon claire et concise en te basant UNIQUEMENT sur les décisions fournies.
Si l'information n'est pas dans l'historique, dis-le clairement.
Cite toujours la décision source de ta réponse.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
};


