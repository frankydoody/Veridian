import { generateWithFallback } from '../config/gemini.js';

export const extractDecisions = async (transcription) => {

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


  const text = await generateWithFallback(prompt);
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  return JSON.parse(cleanText);
};


export const detectContradiction = async (newDecision, pastDecisions) => {
  if (pastDecisions.length === 0) return null;



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

  const text = await generateWithFallback(prompt);
  const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const analysis = JSON.parse(cleanText);

  if (!analysis.hasContradiction) return null;

  return {
    conflictDecision: pastDecisions[analysis.conflictIndex - 1],
    severity: analysis.severity,
    explanation: analysis.explanation,
  };
};


// chunks  : lignes retournées par searchSimilarChunks
//           (chunk_text, chunk_type, meeting_title, similarity)
// history : derniers échanges de la conversation [{ role, content }] (optionnel),
//           pour comprendre les questions de suivi (« et qui s'en occupe ? »).
export const chatWithMemory = async (question, chunks, history = []) => {

  const context = chunks
    .map((c, i) => {
      const label = c.chunk_type === 'decision' ? 'Décision' : 'Extrait de transcription';
      return `Source ${i + 1} — ${label} (réunion « ${c.meeting_title} ») :\n${c.chunk_text}`;
    })
    .join('\n\n');

  const conversation = history.length > 0
    ? `Début de la conversation (pour comprendre les questions de suivi, ce ne sont PAS des sources) :
${history.map((m) => `${m.role === 'user' ? 'Utilisateur' : 'Assistant'} : ${m.content}`).join('\n')}

`
    : '';

  const prompt = `Tu es l'assistant mémoire organisationnelle de Veridian.
Tu aides les équipes à retrouver et comprendre les décisions passées de leur projet.

${conversation}Voici les extraits pertinents trouvés dans l'historique du projet :

${context}

Question de l'utilisateur : ${question}

Réponds de façon claire et concise en te basant UNIQUEMENT sur les extraits fournis.
Si l'information n'est pas dans l'historique, dis-le clairement.
Cite toujours la source (numéro et réunion) de ta réponse.`;

return await generateWithFallback(prompt);
};


// ─── Bloc 19 : analyse complète d'une réunion ───────────────────────────────

const parseJsonResponse = (text) =>
  JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());

/**
 * Découpe une transcription en projets, décisions et tâches (avec acteur et date).
 *
 * @param transcription texte complet de la réunion
 * @param ctx { projects: [{name, description}], people: [{name}], defaultProject: {name}, today: 'AAAA-MM-JJ' }
 * @returns { projects, decisions, tasks } — brut, à passer par normalizeAnalysis
 */
export const analyzeMeeting = async (transcription, ctx) => {
  const { projects = [], people = [], defaultProject, today } = ctx;

  const prompt = `Tu es un assistant qui transforme la transcription d'une réunion d'entreprise en éléments de gestion de projet.

Date du jour : ${today}
Projet de la réunion (par défaut) : « ${defaultProject.name} »
Projets existants de l'organisation :
${projects.length ? projects.map((p) => `- ${p.name}${p.description ? ` : ${p.description}` : ''}`).join('\n') : '- (aucun)'}
Personnes connues (acteurs possibles) :
${people.length ? people.map((p) => `- ${p.name}`).join('\n') : '- (aucune)'}

Travail demandé :
1. projects : les projets réellement discutés. Si un projet existant est discuté, reprends EXACTEMENT son nom. Si un nouveau projet est évoqué (absent de la liste), donne-lui un nom court et une description d'une phrase.
2. decisions : les décisions prises (pas les simples idées ni les questions).
3. tasks : les actions à faire. Une tâche a un seul acteur : choisis-le parmi les personnes connues en reprenant son nom exact, sinon le nom prononcé, sinon null.

Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après, de la forme :
{
  "projects": [{ "name": "...", "description": "..." }],
  "decisions": [{ "project": "nom du projet", "content": "...", "context": "pourquoi", "responsible": "nom ou null", "alternatives": ["..."], "confidence": 0-100 }],
  "tasks": [{ "project": "nom du projet", "title": "verbe d'action + objet", "description": "détails utiles pour réaliser la tâche", "assignee": "nom ou null", "priority": "haute|moyenne|basse", "dueDate": "AAAA-MM-JJ ou null", "dueReason": "d'où vient la date" }]
}

Règles pour dueDate : utilise la date dite en réunion (« vendredi », « fin du mois ») calculée à partir de la date du jour ; sinon propose une date réaliste selon l'effort et la priorité. Ne laisse null qu'en dernier recours.
Si un élément est absent, retourne un tableau vide pour sa clé.

TRANSCRIPTION :
${transcription}`;

  const text = await generateWithFallback(prompt);
  return parseJsonResponse(text);
};

/**
 * Pour un projet qui a déjà un historique : repère les risques et problèmes possibles
 * créés par ce que la réunion vient de décider ou d'assigner.
 *
 * @param project   { name, description }
 * @param incoming  { decisions: [...], tasks: [...] } issus de la réunion
 * @param history   { decisions: [...], openTasks: [...] } du projet avant la réunion
 * @returns tableau brut { kind, description, severity, mitigation }
 */
export const assessProjectRisks = async (project, incoming, history) => {
  const list = (items, fmt) => (items.length ? items.map(fmt).join('\n') : '- (aucun)');

  const prompt = `Tu es un chef de projet expérimenté qui relit un projet après une réunion.

Projet : « ${project.name} »${project.description ? ` — ${project.description}` : ''}

Décisions déjà prises avant la réunion :
${list(history.decisions, (d) => `- ${d.content}`)}

Tâches encore ouvertes avant la réunion :
${list(history.openTasks, (t) => `- ${t.title} (acteur : ${t.assignee || 'non assigné'}, échéance : ${t.due_date ? new Date(t.due_date).toISOString().slice(0, 10) : 'aucune'})`)}

Ce que la réunion vient d'ajouter :
Décisions :
${list(incoming.decisions, (d) => `- ${d.content}`)}
Tâches :
${list(incoming.tasks, (t) => `- ${t.title} (acteur : ${t.assigneeName || 'non assigné'}, échéance : ${t.dueDate.toISOString().slice(0, 10)})`)}

Cherche uniquement des problèmes concrets et justifiables par les éléments ci-dessus :
- incoherence : une nouvelle décision ou tâche est incompatible avec l'existant
- echeance : une échéance irréaliste, ou un acteur surchargé (beaucoup de tâches proches)
- dependance : une tâche dépend d'une autre non planifiée ou d'une personne non assignée
- risque : tout autre risque réel (budget, sécurité, délai, qualité)

Retourne UNIQUEMENT un tableau JSON valide, sans texte avant ou après :
[{ "kind": "incoherence|echeance|dependance|risque", "description": "le problème, précis", "severity": "low|medium|high", "mitigation": "action recommandée" }]
Si rien de sérieux n'est détecté, retourne [].`;

  const text = await generateWithFallback(prompt);
  return parseJsonResponse(text);
};
