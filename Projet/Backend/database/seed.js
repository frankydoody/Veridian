// database/seed.js
// Données de démonstration : 3 utilisateurs, 3 projets, des réunions avec transcription,
// des décisions (dont des contradictions), des alertes et des tâches.
//
// Usage (depuis Projet/Backend) :
//   node database/seed.js                   crée les données si elles n'existent pas encore
//   node database/seed.js --no-embeddings   idem, sans indexer la mémoire vectorielle (pas d'appel à Gemini)
//
// Le script est idempotent : si le compte admin de démonstration existe déjà, il ne fait rien.
// Il est lancé automatiquement par start.ps1 / start.sh sur une base vide.

import 'dotenv/config';
import pool from '../src/config/db.js';
import { hashPassword } from '../src/utils/hash.utils.js';

const PASSWORD = '12345678';
const WITH_EMBEDDINGS = !process.argv.includes('--no-embeddings');

// ─── Utilisateurs ────────────────────────────────────────────────────────────

const USERS = [
  { key: 'admin',  name: 'Admin Veridian',  email: 'admin@example.com',           role: 'admin'  },
  { key: 'marie',  name: 'Marie Tremblay',  email: 'marie.tremblay@example.com',  role: 'member' },
  { key: 'samuel', name: 'Samuel Gagnon',   email: 'samuel.gagnon@example.com',   role: 'member' },
];

// ─── Projets, réunions, décisions, tâches ────────────────────────────────────
// daysAgo : ancienneté de la réunion ; daysFromNow : réunion planifiée à venir.
// Les décisions "contradicts" créent une alerte vers une décision plus ancienne.

const PROJECTS = [
  {
    name: 'Refonte du site web client',
    description: "Refonte complète du site vitrine du client : nouvelle identité visuelle, nouvelle pile technique et hébergement.",
    owner: 'admin',
    members: ['marie', 'samuel'],
    meetings: [
      {
        ref: 'A1',
        title: 'Lancement - cadrage du projet',
        description: 'Objectifs, pile technique, échéancier et répartition des rôles.',
        daysAgo: 21,
        host: 'admin',
        attendees: ['marie', 'samuel'],
        transcription: [
          "Admin Veridian : Bonjour tout le monde. L'objectif aujourd'hui, c'est de cadrer la refonte du site du client et de choisir la technologie.",
          "Samuel Gagnon : Je propose React avec Vite. L'équipe connaît déjà React, et le démarrage est très rapide. J'avais regardé Vue 3 et Next.js, mais Next.js est trop lourd pour un site vitrine.",
          "Marie Tremblay : D'accord avec React et Vite. Ça facilite aussi la réutilisation des composants pour les maquettes.",
          "Admin Veridian : Parfait, on retient React avec Vite, et Samuel en est responsable. Pour l'hébergement, je suggère Cloudflare Pages : c'est simple, rapide et gratuit à ce volume.",
          "Samuel Gagnon : Netlify ferait aussi l'affaire, ou le serveur interne, mais Cloudflare Pages me convient.",
          "Admin Veridian : Alors c'est décidé, on héberge chez Cloudflare Pages. Je m'en occupe.",
          "Marie Tremblay : Côté échéancier, il faut livrer une première version à la fin de décembre pour que le client puisse la tester avant les fêtes.",
          "Admin Veridian : Entendu, première version livrée à la fin de décembre. Samuel, tu initialises le dépôt cette semaine. Moi, je rédige le cahier des charges.",
          "Samuel Gagnon : Je crée le dépôt React et Vite avec la configuration de qualité de code dès demain.",
        ].join('\n'),
        decisions: [
          { ref: 'A1-1', content: 'Utiliser React avec Vite pour le nouveau site', context: "L'équipe maîtrise déjà React et Vite offre un démarrage rapide ; Next.js jugé trop lourd pour un site vitrine.", responsible: 'Samuel Gagnon', alternatives: ['Vue 3', 'Next.js'], confidence: 95, status: 'confirmed' },
          { ref: 'A1-2', content: 'Héberger le site chez Cloudflare Pages', context: 'Solution simple, rapide et gratuite pour le volume attendu.', responsible: 'Admin Veridian', alternatives: ['Netlify', 'Serveur interne'], confidence: 90, status: 'contradicted' },
          { ref: 'A1-3', content: 'Livrer la première version à la fin de décembre', context: 'Le client souhaite tester le site avant les fêtes.', responsible: 'Admin Veridian', alternatives: [], confidence: 85, status: 'confirmed' },
        ],
        tasks: [
          { title: "Initialiser le dépôt React et Vite avec la configuration de qualité de code", assignee: 'samuel', priority: 'haute', status: 'done' },
          { title: 'Rédiger le cahier des charges du site', assignee: 'admin', priority: 'haute', status: 'todo', dueInDays: -2 },
        ],
      },
      {
        ref: 'A2',
        title: 'Atelier design et maquettes',
        description: 'Palette de couleurs, navigation et validation des maquettes.',
        daysAgo: 14,
        host: 'marie',
        attendees: ['admin', 'samuel'],
        transcription: [
          "Marie Tremblay : J'ai préparé trois pistes de maquettes. Ma recommandation est une palette verte, plus fidèle à l'identité du client, avec un thème sombre en option.",
          "Admin Veridian : La palette bleue du site actuel ne reflète plus la marque, je suis d'accord pour passer au vert.",
          "Samuel Gagnon : Le thème sombre en option est simple à gérer avec des variables de couleur. Je peux le faire sans retarder le reste.",
          "Marie Tremblay : Autre point : la navigation actuelle compte neuf entrées, c'est trop. Je propose de la limiter à cinq sections principales.",
          "Admin Veridian : Oui, cinq sections maximum : Accueil, Services, Réalisations, Blogue et Contact.",
          "Samuel Gagnon : Est-ce qu'on fait valider les maquettes par le client avant de commencer le développement ?",
          "Admin Veridian : Bonne idée, mais je dois confirmer avec le client qu'il a le temps. On le met comme décision provisoire pour l'instant.",
          "Marie Tremblay : Je termine les maquettes de la page d'accueil et je conçois les jetons de couleur du thème sombre.",
        ].join('\n'),
        decisions: [
          { ref: 'A2-1', content: "Adopter une palette verte avec un thème sombre en option", context: "La palette bleue de l'ancien site ne reflète plus l'identité de la marque.", responsible: 'Marie Tremblay', alternatives: ['Conserver la palette bleue'], confidence: 92, status: 'confirmed' },
          { ref: 'A2-2', content: 'Limiter la navigation principale à cinq sections', context: 'La navigation actuelle compte neuf entrées, ce qui nuit à la lisibilité.', responsible: 'Marie Tremblay', alternatives: [], confidence: 88, status: 'confirmed' },
          { ref: 'A2-3', content: 'Faire valider les maquettes par le client avant le développement', context: 'Disponibilité du client à confirmer.', responsible: 'Admin Veridian', alternatives: [], confidence: 70, status: 'draft' },
        ],
        tasks: [
          { title: "Produire les maquettes de la page d'accueil", assignee: 'marie', priority: 'haute', status: 'done' },
          { title: 'Concevoir les jetons de couleur du thème sombre', assignee: 'marie', priority: 'moyenne', status: 'in_progress', dueInDays: 5 },
          { title: "Envoyer les maquettes au client pour validation", assignee: 'admin', priority: 'moyenne', status: 'todo', dueInDays: 4 },
        ],
      },
      {
        ref: 'A3',
        title: 'Suivi technique - hébergement et sécurité',
        description: "Révision du choix d'hébergement et exigences de sécurité de l'espace administrateur.",
        daysAgo: 5,
        host: 'admin',
        attendees: ['samuel', 'marie'],
        transcription: [
          "Admin Veridian : Changement de contexte : le client exige que les données restent au Canada et sous son contrôle. Cloudflare Pages ne répond plus à cette exigence.",
          "Samuel Gagnon : Dans ce cas, on peut déployer le site dans un conteneur Docker sur le serveur interne. J'ai déjà une configuration prête.",
          "Admin Veridian : Alors on abandonne Cloudflare Pages et on migre l'hébergement vers le serveur interne avec Docker. Netlify n'est pas mieux sur ce point.",
          "Samuel Gagnon : Je recommande aussi d'activer l'authentification à deux facteurs pour l'espace administrateur du site.",
          "Marie Tremblay : Oui, c'est indispensable, surtout si le contenu du blogue est géré par le client.",
          "Admin Veridian : Décision prise : double authentification obligatoire pour l'administration. Samuel s'en charge.",
          "Samuel Gagnon : Je rédige aussi une courte politique de mots de passe pour accompagner ça.",
          "Admin Veridian : Je mets en place le serveur Docker interne cette semaine ou la suivante.",
        ].join('\n'),
        decisions: [
          { ref: 'A3-1', content: "Migrer l'hébergement vers le serveur interne (Docker) plutôt que Cloudflare Pages", context: 'Le client exige que les données restent au Canada et sous son contrôle.', responsible: 'Admin Veridian', alternatives: ['Cloudflare Pages', 'Netlify'], confidence: 93, status: 'confirmed',
            contradicts: { ref: 'A1-2', severity: 'high', explanation: "La décision d'héberger le site chez Cloudflare Pages (lancement) est remplacée par un hébergement sur le serveur interne : les deux décisions sont incompatibles et l'ancienne doit être considérée comme caduque." } },
          { ref: 'A3-2', content: "Activer l'authentification à deux facteurs pour l'espace administrateur", context: "Le contenu du blogue sera géré par le client : l'accès à l'administration doit être protégé.", responsible: 'Samuel Gagnon', alternatives: [], confidence: 94, status: 'confirmed' },
        ],
        tasks: [
          { title: 'Mettre en place le serveur Docker interne pour héberger le site', assignee: 'admin', priority: 'haute', status: 'todo', dueInDays: 7 },
          { title: "Activer l'authentification à deux facteurs de l'administration", assignee: 'samuel', priority: 'haute', status: 'todo', dueInDays: 10 },
          { title: 'Rédiger la politique de mots de passe', assignee: 'samuel', priority: 'basse', status: 'todo', dueInDays: 12 },
        ],
      },
      {
        ref: 'A4',
        title: 'Revue de sprint',
        description: "Réunion planifiée : démonstration de l'avancement. Aucune transcription : sert à tester le téléversement audio.",
        daysFromNow: 3,
        status: 'planned',
        host: 'admin',
        attendees: ['marie', 'samuel'],
      },
    ],
  },
  {
    name: 'Application mobile Atlas',
    description: "Application mobile de suivi de chantier pour les équipes terrain, avec mode hors ligne.",
    owner: 'marie',
    members: ['admin'],
    meetings: [
      {
        ref: 'B1',
        title: 'Définition des fonctionnalités',
        description: 'Technologie, périmètre de la première version et priorités.',
        daysAgo: 10,
        host: 'marie',
        attendees: ['admin'],
        transcription: [
          "Marie Tremblay : Pour Atlas, je recommande React Native. On réutilise nos compétences React et on couvre iOS et Android avec un seul code. Flutter serait possible, mais personne ne le connaît.",
          "Admin Veridian : D'accord. Sur le terrain, la couverture réseau est souvent mauvaise, donc le mode hors ligne doit être prioritaire dans la première version.",
          "Marie Tremblay : Entendu, on priorise le mode hors ligne avec une base locale SQLite et une synchronisation à la reconnexion.",
          "Admin Veridian : Et les notifications push ? Ce n'est pas essentiel au départ, on peut les repousser.",
          "Marie Tremblay : Oui, notifications push reportées à la version 2. On se concentre sur la saisie des rapports de chantier et la synchronisation.",
          "Admin Veridian : Je valide l'enveloppe budgétaire avec la direction la semaine prochaine. Toi, tu prépares un prototype React Native.",
        ].join('\n'),
        decisions: [
          { ref: 'B1-1', content: "Développer l'application avec React Native", context: "Réutilisation des compétences React de l'équipe ; un seul code pour iOS et Android.", responsible: 'Marie Tremblay', alternatives: ['Flutter', 'Développement natif'], confidence: 91, status: 'confirmed' },
          { ref: 'B1-2', content: 'Prioriser le mode hors ligne dans la première version', context: 'La couverture réseau est souvent mauvaise sur les chantiers.', responsible: 'Admin Veridian', alternatives: [], confidence: 89, status: 'confirmed' },
          { ref: 'B1-3', content: 'Reporter les notifications push à la version 2', context: 'Fonction non essentielle pour la première version.', responsible: 'Marie Tremblay', alternatives: [], confidence: 78, status: 'contradicted' },
        ],
        tasks: [
          { title: 'Créer le prototype React Native', assignee: 'marie', priority: 'haute', status: 'in_progress', dueInDays: 6 },
          { title: 'Concevoir le stockage hors ligne (SQLite) et la synchronisation', assignee: 'marie', priority: 'haute', status: 'todo', dueInDays: 15 },
          { title: "Valider l'enveloppe budgétaire avec la direction", assignee: 'admin', priority: 'moyenne', status: 'done' },
        ],
      },
      {
        ref: 'B2',
        title: 'Point budget et démonstration client',
        description: 'Budget de développement et contenu de la démonstration.',
        daysAgo: 3,
        host: 'admin',
        attendees: ['marie'],
        transcription: [
          "Admin Veridian : La direction accepte de plafonner le budget de développement à quarante mille dollars. On avait demandé soixante mille, mais ils ne veulent pas aller au-delà.",
          "Marie Tremblay : Dans ce cas, il faut être strict sur le périmètre. Le mode hors ligne reste la priorité.",
          "Admin Veridian : Autre nouveauté : le client veut une démonstration dans trois semaines, et il tient à voir des notifications push, même basiques.",
          "Marie Tremblay : Alors on inclut des notifications push de base dès la première version pour la démonstration, quitte à garder les notifications avancées pour la version 2.",
          "Admin Veridian : Parfait, c'est noté. Marie, tu t'occupes de l'intégration des notifications.",
        ].join('\n'),
        decisions: [
          { ref: 'B2-1', content: 'Plafonner le budget de développement à 40 000 $', context: "La direction refuse d'aller au-delà de 40 000 $ (60 000 $ demandés).", responsible: 'Admin Veridian', alternatives: ['Budget de 60 000 $'], confidence: 92, status: 'confirmed' },
          { ref: 'B2-2', content: 'Inclure des notifications push de base dès la première version pour la démonstration client', context: 'Le client veut voir des notifications lors de la démonstration dans trois semaines.', responsible: 'Marie Tremblay', alternatives: [], confidence: 86, status: 'confirmed',
            contradicts: { ref: 'B1-3', severity: 'medium', explanation: "Les notifications push étaient reportées à la version 2 ; elles sont maintenant demandées dès la première version (au moins en version de base) pour la démonstration." } },
        ],
        tasks: [
          { title: 'Intégrer les notifications push de base', assignee: 'marie', priority: 'moyenne', status: 'todo', dueInDays: 14 },
        ],
      },
    ],
  },
  {
    name: 'Plan de relève RH (confidentiel)',
    description: "Projet confidentiel visible uniquement par son propriétaire : sert à vérifier l'isolation des données entre utilisateurs.",
    owner: 'samuel',
    members: [],
    meetings: [
      {
        ref: 'C1',
        title: 'Planification des postes critiques',
        description: 'Identification des postes critiques et des successeurs potentiels.',
        daysAgo: 7,
        host: 'samuel',
        attendees: [],
        transcription: [
          "Samuel Gagnon : Cette réunion est confidentielle. L'objectif est d'identifier les postes critiques à protéger en cas de départ.",
          "Samuel Gagnon : Je retiens trois postes : la direction technique, la comptabilité et l'administration des systèmes. Pour chacun, il faut nommer un successeur potentiel avant la fin du trimestre.",
          "Samuel Gagnon : Décision : documenter les procédures des trois postes critiques avant d'engager la formation des remplaçants.",
        ].join('\n'),
        decisions: [
          { ref: 'C1-1', content: 'Identifier un successeur potentiel pour chacun des trois postes critiques', context: 'Direction technique, comptabilité et administration des systèmes.', responsible: 'Samuel Gagnon', alternatives: [], confidence: 90, status: 'confirmed' },
          { ref: 'C1-2', content: "Documenter les procédures des postes critiques avant la formation des remplaçants", context: 'Les connaissances doivent être écrites avant d\'être transmises.', responsible: 'Samuel Gagnon', alternatives: [], confidence: 87, status: 'confirmed' },
        ],
        tasks: [
          { title: 'Cartographier les postes critiques et leurs successeurs', assignee: 'samuel', priority: 'haute', status: 'in_progress', dueInDays: 9 },
        ],
      },
    ],
  },
];

// ─── Exécution ───────────────────────────────────────────────────────────────

const log = (msg) => console.log(`[Seed] ${msg}`);

const insertSeed = async (client) => {
  const passwordHash = await hashPassword(PASSWORD);
  const userIds = {};
  const userNames = {};

  for (const u of USERS) {
    const r = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [u.name, u.email, passwordHash, u.role]
    );
    userIds[u.key] = r.rows[0].id;
    userNames[u.key] = u.name;
  }

  const decisionIds = {};
  const indexable = []; // réunions avec transcription, pour la mémoire vectorielle
  let counts = { projects: 0, meetings: 0, decisions: 0, alerts: 0, tasks: 0 };

  for (const p of PROJECTS) {
    const pr = await client.query(
      `INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING id`,
      [p.name, p.description, userIds[p.owner]]
    );
    const projectId = pr.rows[0].id;
    counts.projects++;

    await client.query(
      `INSERT INTO project_members (user_id, project_id, role) VALUES ($1, $2, 'owner')`,
      [userIds[p.owner], projectId]
    );
    for (const m of p.members) {
      await client.query(
        `INSERT INTO project_members (user_id, project_id, role) VALUES ($1, $2, 'member')`,
        [userIds[m], projectId]
      );
    }

    for (const m of p.meetings) {
      const planned = m.status === 'planned';
      const offsetDays = planned ? -m.daysFromNow : m.daysAgo; // négatif = dans le futur
      const mr = await client.query(
        `INSERT INTO meetings (project_id, title, description, status, started_at, ended_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4,
                 NOW() - make_interval(days => $5),
                 CASE WHEN $6 THEN NULL ELSE NOW() - make_interval(days => $5) + interval '45 minutes' END,
                 NOW() - make_interval(days => $5 + 1),
                 NOW() - make_interval(days => $5))
         RETURNING id`,
        [projectId, m.title, m.description, planned ? 'planned' : 'done', offsetDays, planned]
      );
      const meetingId = mr.rows[0].id;
      counts.meetings++;

      await client.query(
        `INSERT INTO participants (meeting_id, user_id, display_name, role) VALUES ($1, $2, $3, 'host')`,
        [meetingId, userIds[m.host], userNames[m.host]]
      );
      for (const a of m.attendees) {
        await client.query(
          `INSERT INTO participants (meeting_id, user_id, display_name, role) VALUES ($1, $2, $3, 'attendee')`,
          [meetingId, userIds[a], userNames[a]]
        );
      }

      if (m.transcription) {
        await client.query(
          `INSERT INTO transcriptions (meeting_id, raw_text, language) VALUES ($1, $2, 'fr')`,
          [meetingId, m.transcription]
        );
      }

      const insertedDecisions = [];
      for (const d of m.decisions || []) {
        const dr = await client.query(
          `INSERT INTO decisions (meeting_id, project_id, content, context, responsible, alternatives, confidence, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                   NOW() - make_interval(days => $9) + interval '1 hour',
                   NOW() - make_interval(days => $9) + interval '1 hour')
           RETURNING id, content, context, responsible`,
          [meetingId, projectId, d.content, d.context, d.responsible, d.alternatives, d.confidence, d.status, offsetDays]
        );
        decisionIds[d.ref] = dr.rows[0].id;
        insertedDecisions.push(dr.rows[0]);
        counts.decisions++;

        if (d.contradicts) {
          await client.query(
            `INSERT INTO alerts (new_decision_id, conflict_decision_id, project_id, explanation, severity)
             VALUES ($1, $2, $3, $4, $5)`,
            [decisionIds[d.ref], decisionIds[d.contradicts.ref], projectId, d.contradicts.explanation, d.contradicts.severity]
          );
          counts.alerts++;
        }
      }

      for (const t of m.tasks || []) {
        await client.query(
          `INSERT INTO tasks (title, assignee, priority, status, meeting_id, project_id, user_id, due_date)
           VALUES ($1, $2, $3, $4, $5, $6, $7,
                   CASE WHEN $8::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $8::int) END)`,
          [t.title, userNames[t.assignee], t.priority, t.status, meetingId, projectId, userIds[t.assignee], t.dueInDays ?? null]
        );
        counts.tasks++;
      }

      if (m.transcription) {
        indexable.push({ meetingId, projectId, text: m.transcription, decisions: insertedDecisions });
      }
    }
  }

  return { counts, indexable };
};

// Mémoire vectorielle (recherche et chat) : nécessite la clé Gemini. Jamais bloquant.
const indexMemory = async (indexable) => {
  if (!WITH_EMBEDDINGS) { log('Mémoire vectorielle ignorée (--no-embeddings).'); return; }
  if (!process.env.GEMINI_API_KEY) { log('Pas de clé GEMINI_API_KEY : mémoire vectorielle non indexée.'); return; }

  log('Indexation de la mémoire vectorielle (Gemini)...');
  const { indexTranscription, indexDecisions } = await import('../src/services/memory.service.js');
  let ok = 0;
  for (const m of indexable) {
    try {
      await indexTranscription(m.meetingId, m.projectId, m.text);
      await indexDecisions(m.meetingId, m.projectId, m.decisions);
      ok++;
    } catch (error) {
      log(`Indexation ignorée pour une réunion : ${error.message}`);
    }
  }
  log(`Mémoire vectorielle : ${ok}/${indexable.length} réunion(s) indexée(s).`);
};

const main = async () => {
  const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [USERS[0].email]);
  if (existing.rowCount > 0) {
    log('Données de démonstration déjà présentes : rien à faire.');
    return;
  }

  const client = await pool.connect();
  let result;
  try {
    await client.query('BEGIN');
    result = await insertSeed(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const c = result.counts;
  log(`${USERS.length} utilisateurs, ${c.projects} projets, ${c.meetings} réunions, ${c.decisions} décisions, ${c.alerts} alertes, ${c.tasks} tâches créés.`);

  await indexMemory(result.indexable);

  console.log('');
  console.log('[Seed] Comptes de démonstration (mot de passe : ' + PASSWORD + ')');
  for (const u of USERS) console.log(`[Seed]   ${u.email.padEnd(30)} ${u.role}`);
};

main()
  .catch((error) => {
    console.error('[Seed] Échec :', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
