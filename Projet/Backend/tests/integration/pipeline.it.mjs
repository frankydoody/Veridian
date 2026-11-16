// tests/integration/pipeline.it.mjs
// Scénario complet du bloc 19 sur une VRAIE base PostgreSQL, avec une IA simulée
// (aucune clé Gemini nécessaire, aucun courriel réel envoyé).
//
// Prérequis : base démarrée et peuplée (node database/seed.js), migration 010 appliquée.
// Lancer (depuis Projet/Backend) :   node tests/integration/pipeline.it.mjs
//
// Ce que le script vérifie en lisant le résultat dans la base :
//  - un projet existant est réutilisé, un nouveau projet est créé (avec son propriétaire)
//  - les acteurs sont liés à de vrais utilisateurs ; un nom inconnu reste « non lié »
//  - une date absente est estimée (marquée « ~ ») ; une date donnée est conservée
//  - une contradiction crée une alerte, un historique existant déclenche l'analyse des risques
//  - un courriel par acteur + un résumé pour l'organisateur (mode console, statut « logged »)
//  - relancer l'analyse remplace le résultat au lieu de le dupliquer
//  - un acteur ne voit que les tâches des projets dont il est membre
// Le script ajoute une réunion « Réunion test pipeline » dans la base de développement.

import { GoogleGenerativeAI } from '@google/generative-ai';
const calls = [];
GoogleGenerativeAI.prototype.getGenerativeModel = function () {
  return {
    embedContent: async () => { throw new Error('pas d\'embeddings en test'); },
    generateContent: async (prompt) => {
      let out;
      if (prompt.includes('TRANSCRIPTION :')) {
        calls.push('analyze');
        out = { projects: [{ name: 'Refonte du site web client' }, { name: 'Portail fournisseurs', description: 'Nouveau portail pour les fournisseurs du client' }],
          decisions: [
            { project: 'Refonte du site web client', content: 'Héberger le site sur Cloudflare Pages', context: 'Rapidité', responsible: 'Marie', alternatives: ['Serveur interne'], confidence: 90 },
            { project: 'Portail fournisseurs', content: 'Construire le portail avec React', confidence: 80 }],
          tasks: [
            { project: 'Refonte du site web client', title: 'Configurer Cloudflare Pages', description: 'Créer le projet, brancher le dépôt, tester le déploiement', assignee: 'Marie', priority: 'haute', dueDate: '2026-11-12' },
            { project: 'Refonte du site web client', title: 'Rédiger le plan de migration', assignee: 'Samuel Gagnon', priority: 'moyenne', dueDate: null },
            { project: 'Portail fournisseurs', title: 'Faire les maquettes', assignee: 'Samuel', priority: 'haute', dueDate: '2026-11-20' },
            { project: 'Portail fournisseurs', title: 'Valider avec le client', assignee: 'Quelqu\'un du client', priority: 'basse', dueDate: null }] };
      } else if (prompt.includes('Nouvelle décision')) {
        calls.push('contradiction');
        out = { hasContradiction: true, conflictIndex: 1, severity: 'high', explanation: 'Contredit la décision d\'héberger sur le serveur interne.' };
      } else if (prompt.includes('chef de projet')) {
        calls.push('risks');
        out = [{ kind: 'echeance', description: 'Marie cumule plusieurs tâches urgentes', severity: 'medium', mitigation: 'Répartir avec Samuel' }];
      } else out = {};
      return { response: { text: () => JSON.stringify(out) } };
    },
  };
};
const { query } = await import('../../src/config/db.js');
const { processMeeting } = await import('../../src/services/meeting-pipeline.service.js');
const { findAnalysisByMeeting } = await import('../../src/models/pipeline.model.js');
const { findAllTasks } = await import('../../src/models/task.model.js');
const { findMeetingById } = await import('../../src/models/meeting.model.js');
const { createTranscription } = await import('../../src/models/transcription.model.js');

const admin = (await query(`select id,name,email from users where email='admin@example.com'`)).rows[0];
const marie = (await query(`select id,name,email from users where email like 'marie%'`)).rows[0];
const proj = (await query(`select id from projects where name='Refonte du site web client'`)).rows[0];
const m = (await query(`insert into meetings (project_id,title) values ($1,'Réunion test pipeline') returning id`, [proj.id])).rows[0];
await createTranscription(m.id, 'Marie configurera Cloudflare Pages avant le 12 novembre. Samuel fera les maquettes du portail.');

const meeting = await findMeetingById(m.id, admin.id);
const r1 = await processMeeting(meeting, admin, { now: new Date('2026-11-02T14:00:00Z') });
console.log('PROJETS', r1.projects.map(p => `${p.name}${p.isNew ? ' (nouveau)' : ''}`));
console.log('TÂCHES', r1.tasks.map(t => `${t.title} → ${t.assignee}/${t.assignee_id ? 'lié' : 'non lié'} ${t.due_date.toISOString().slice(0,10)}${t.due_estimated ? '~' : ''}`));
console.log('ALERTES', r1.alerts.length, 'RISQUES', r1.risks.length, 'COURRIELS', r1.notifications.map(n => `${n.kind}:${n.email}:${n.status}`));
const r2 = await processMeeting(meeting, admin, { now: new Date('2026-11-02T14:00:00Z'), notify: false });
const a = await findAnalysisByMeeting(m.id);
console.log('APRÈS 2e ANALYSE: décisions', a.decisions.length, 'tâches', a.tasks.length, 'risques', a.risks.length);
const st = (await query(`select analysis_status,status from meetings where id=$1`, [m.id])).rows[0];
console.log('ÉTAT', st);
const marieTasks = await findAllTasks(marie.id);
console.log('MARIE VOIT', marieTasks.filter(t => t.meeting_title === 'Réunion test pipeline').map(t => t.title));
const samuel = (await query(`select id from users where email like 'samuel%'`)).rows[0];
console.log('SAMUEL VOIT', (await findAllTasks(samuel.id)).filter(t => t.meeting_title === 'Réunion test pipeline').map(t => t.title));
console.log('MEMBRES nouveau projet', (await query(`select u.name from project_members pm join users u on u.id=pm.user_id join projects p on p.id=pm.project_id where p.name='Portail fournisseurs' and pm.is_active`)).rows.map(r=>r.name));
console.log('APPELS IA', calls);
process.exit(0);
