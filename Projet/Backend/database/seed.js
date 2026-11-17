// database/seed.js
// DONNÉES DE TEST (facultatives) : 3 comptes, 4 projets, des réunions transcrites et analysées,
// des décisions (dont des contradictions volontaires), des alertes, des risques, des tâches liées
// à leurs acteurs avec des échéances, et le journal des courriels.
//
// Ces données ne sont PAS créées par défaut : elles servent à essayer l'application ou à la
// présenter. Elles imitent exactement le résultat de la vraie chaîne (bloc 19) : tâches
// « source = ai » liées à un compte, réunions « analysées », courriels en mode console.
//
// Usage (depuis Projet/Backend) :
//   node database/seed.js                   ajoute les données de test si elles n'existent pas
//   node database/seed.js --no-embeddings   idem, sans indexer la mémoire vectorielle (pas d'appel à Gemini)
//
// Idempotent : si le compte admin@example.com existe déjà, le script ne fait rien.
//
// Scénarios :
//  - « Refonte du site web client » : 3 réunions passées + 1 planifiée (calendrier).
//    La 3e réunion contredit l'hébergement choisi à la 1re (alerte) et CRÉE un nouveau projet,
//    « Boutique en ligne » (affiché « Nouveau, créé par cette réunion »).
//  - « Application mobile Atlas » : scénario en 3 réunions d'un même projet —
//    création (périmètre), contradiction (notifications push), mise à jour (avancement, risques).
//  - « Plan de relève RH (confidentiel) » : visible seulement par Samuel (isolation des données).

import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../src/utils/hash.utils.js';

export const SEED_PASSWORD = '12345678';

// ─── Utilisateurs ────────────────────────────────────────────────────────────

export const SEED_USERS = [
  { key: 'admin',  name: 'Admin Veridian',  email: 'admin@example.com',           role: 'admin'  },
  { key: 'marie',  name: 'Marie Tremblay',  email: 'marie.tremblay@example.com',  role: 'member' },
  { key: 'samuel', name: 'Samuel Gagnon',   email: 'samuel.gagnon@example.com',   role: 'member' },
];

// ─── Projets, réunions, décisions, tâches ────────────────────────────────────
// daysAgo : ancienneté de la réunion ; daysFromNow : réunion planifiée à venir.
// Les décisions « contradicts » créent une alerte vers une décision plus ancienne.
// Tâches : dueInDays = échéance relative (jour, à 17 h UTC) ; estimated = date estimée par l'analyse
// (aucune date n'avait été dite) ; project = clé d'un projet créé par la réunion.

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
          { title: "Initialiser le dépôt React et Vite avec la configuration de qualité de code", assignee: 'samuel', priority: 'haute', status: 'done', dueInDays: -20 },
          { title: 'Rédiger le cahier des charges du site', assignee: 'admin', priority: 'haute', status: 'todo', dueInDays: -2, estimated: true },
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
          { title: "Produire les maquettes de la page d'accueil", assignee: 'marie', priority: 'haute', status: 'done', dueInDays: -10 },
          { title: 'Concevoir les jetons de couleur du thème sombre', assignee: 'marie', priority: 'moyenne', status: 'in_progress', dueInDays: 5, estimated: true },
          { title: "Envoyer les maquettes au client pour validation", assignee: 'admin', priority: 'moyenne', status: 'todo', dueInDays: 4, estimated: true },
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
          "Admin Veridian : Dernier point : le client nous confie un deuxième mandat, une boutique en ligne pour vendre ses produits. On la lance comme projet séparé.",
          "Samuel Gagnon : Je peux recenser les produits à mettre en ligne avant la fin du mois.",
        ].join('\n'),
        // L'analyse de cette réunion a CRÉÉ ce projet (projects.source_meeting_id)
        createsProject: {
          key: 'boutique',
          name: 'Boutique en ligne',
          description: 'Boutique en ligne où le client vend ses produits, avec paiement sécurisé.',
          members: ['samuel'],
        },
        decisions: [
          { ref: 'A3-1', content: "Migrer l'hébergement vers le serveur interne (Docker) plutôt que Cloudflare Pages", context: 'Le client exige que les données restent au Canada et sous son contrôle.', responsible: 'Admin Veridian', alternatives: ['Cloudflare Pages', 'Netlify'], confidence: 93, status: 'confirmed',
            contradicts: { ref: 'A1-2', severity: 'high', explanation: "La décision d'héberger le site chez Cloudflare Pages (lancement) est remplacée par un hébergement sur le serveur interne : les deux décisions sont incompatibles et l'ancienne doit être considérée comme caduque." } },
          { ref: 'A3-2', content: "Activer l'authentification à deux facteurs pour l'espace administrateur", context: "Le contenu du blogue sera géré par le client : l'accès à l'administration doit être protégé.", responsible: 'Samuel Gagnon', alternatives: [], confidence: 94, status: 'confirmed' },
          { ref: 'A3-3', project: 'boutique', content: 'Lancer la boutique en ligne comme projet séparé', context: 'Deuxième mandat confié par le client.', responsible: 'Admin Veridian', alternatives: [], confidence: 88, status: 'confirmed' },
        ],
        tasks: [
          { title: 'Mettre en place le serveur Docker interne pour héberger le site', assignee: 'admin', priority: 'haute', status: 'todo', dueInDays: 7, estimated: true },
          { title: "Activer l'authentification à deux facteurs de l'administration", assignee: 'samuel', priority: 'haute', status: 'todo', dueInDays: 10, estimated: true },
          { title: 'Rédiger la politique de mots de passe', assignee: 'samuel', priority: 'basse', status: 'todo', dueInDays: 12, estimated: true },
          { title: 'Recenser les produits à mettre en ligne', assignee: 'samuel', priority: 'moyenne', status: 'todo', dueInDays: 13, project: 'boutique' },
        ],
        risks: [
          { kind: 'echeance', description: "La migration vers le serveur interne rapproche dangereusement la livraison prévue à la fin de décembre.", severity: 'high', mitigation: "Préparer le serveur Docker dès cette semaine et garder Cloudflare Pages comme environnement de démonstration temporaire." },
          { kind: 'dependance', description: "La double authentification dépend du serveur interne, qui n'est pas encore installé.", severity: 'medium', mitigation: "Développer la double authentification en local, puis la déployer après la mise en place du serveur." },
        ],
      },
      {
        ref: 'A4',
        title: 'Revue de sprint',
        description: "Réunion planifiée : démonstration de l'avancement. Aucune transcription : sert à essayer l'enregistrement audio.",
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
        description: 'Création du projet : technologie, périmètre de la première version et priorités.',
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
          { title: 'Créer le prototype React Native', assignee: 'marie', priority: 'haute', status: 'done', dueInDays: -1 },
          { title: 'Concevoir le stockage hors ligne (SQLite) et la synchronisation', assignee: 'marie', priority: 'haute', status: 'in_progress', dueInDays: 15, estimated: true },
          { title: "Valider l'enveloppe budgétaire avec la direction", assignee: 'admin', priority: 'moyenne', status: 'done', dueInDays: -4 },
        ],
      },
      {
        ref: 'B2',
        title: 'Point budget et démonstration client',
        description: 'Contradiction : budget de développement et notifications demandées pour la démonstration.',
        daysAgo: 6,
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
          { title: 'Intégrer les notifications push de base', assignee: 'marie', priority: 'moyenne', status: 'todo', dueInDays: 14, estimated: true },
        ],
        risks: [
          { kind: 'risque', description: "Ajouter les notifications push avec un budget plafonné à 40 000 $ réduit la marge pour le mode hors ligne, qui reste la priorité.", severity: 'medium', mitigation: "Limiter les notifications à un seul type (nouveau rapport) pour la démonstration." },
        ],
      },
      {
        ref: 'B3',
        title: "Point d'avancement",
        description: 'Mise à jour : prototype livré, synchronisation et préparation de la démonstration.',
        daysAgo: 2,
        host: 'marie',
        attendees: ['admin'],
        transcription: [
          "Marie Tremblay : Bonne nouvelle : le prototype React Native est livré et tourne sur iOS et Android.",
          "Admin Veridian : Excellent. Où en est la synchronisation hors ligne ?",
          "Marie Tremblay : La base locale SQLite fonctionne. Pour les conflits, je propose que la dernière modification l'emporte, avec un historique pour pouvoir revenir en arrière.",
          "Admin Veridian : D'accord, on retient « la dernière modification l'emporte » avec historique. Pour la démonstration, il faut un jeu de données réaliste.",
          "Marie Tremblay : Je prépare un jeu de données de chantier pour la démonstration d'ici dix jours.",
          "Admin Veridian : Et moi, je réserve la salle et j'envoie l'invitation au client.",
        ].join('\n'),
        decisions: [
          { ref: 'B3-1', content: "Résoudre les conflits de synchronisation par « la dernière modification l'emporte », avec historique", context: 'Simple à expliquer aux équipes terrain ; l\'historique permet de corriger une erreur.', responsible: 'Marie Tremblay', alternatives: ['Fusion manuelle des conflits'], confidence: 84, status: 'confirmed' },
        ],
        tasks: [
          { title: 'Préparer un jeu de données de chantier pour la démonstration', assignee: 'marie', priority: 'haute', status: 'todo', dueInDays: 10 },
          { title: "Réserver la salle et envoyer l'invitation au client", assignee: 'admin', priority: 'basse', status: 'todo', dueInDays: 3, estimated: true },
        ],
        risks: [
          { kind: 'echeance', description: "La démonstration approche alors que la synchronisation et les notifications ne sont pas terminées.", severity: 'medium', mitigation: "Montrer la synchronisation sur un scénario préparé et garder les notifications pour la fin de la démonstration." },
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

// ─── Insertion ───────────────────────────────────────────────────────────────

// Échéance : un JOUR, enregistré à 17 h UTC comme le fait l'analyse (BUG-03)
const DUE_DATE_SQL = `CASE WHEN $1::int IS NULL THEN NULL
  ELSE ((CURRENT_DATE + $1::int)::timestamp + interval '17 hours') AT TIME ZONE 'UTC' END`;

const insertSeed = async (client) => {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const userIds = {};
  const users = {};

  for (const u of SEED_USERS) {
    const r = await client.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [u.name, u.email, passwordHash, u.role]
    );
    userIds[u.key] = r.rows[0].id;
    users[u.key] = u;
  }

  const addMember = (projectId, key, role) => client.query(
    `INSERT INTO project_members (user_id, project_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, project_id) DO NOTHING`,
    [userIds[key], projectId, role]
  );
  const dueDate = async (days) => (await client.query(`SELECT ${DUE_DATE_SQL} AS d`, [days ?? null])).rows[0].d;

  const decisionIds = {};
  const indexable = []; // réunions avec transcription, pour la mémoire vectorielle
  const counts = { projects: 0, meetings: 0, decisions: 0, alerts: 0, tasks: 0, risks: 0, emails: 0 };

  for (const p of PROJECTS) {
    const pr = await client.query(
      `INSERT INTO projects (name, description, owner_id) VALUES ($1, $2, $3) RETURNING id`,
      [p.name, p.description, userIds[p.owner]]
    );
    const projectId = pr.rows[0].id;
    counts.projects++;
    await addMember(projectId, p.owner, 'owner');
    for (const m of p.members) await addMember(projectId, m, 'member');

    for (const m of p.meetings) {
      const planned = m.status === 'planned';
      const analyzed = Boolean(m.transcription);
      // Réunion passée : date prévue = début réel, à 14 h ; réunion planifiée : date prévue à venir, à 14 h
      const mr = await client.query(
        `INSERT INTO meetings (project_id, title, description, status, scheduled_at, started_at, ended_at,
                               transcription_status, analysis_status, analyzed_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4,
                 date_trunc('day', NOW()) + make_interval(days => $5) + interval '14 hours',
                 CASE WHEN $6 THEN NULL ELSE date_trunc('day', NOW()) + make_interval(days => $5) + interval '14 hours' END,
                 CASE WHEN $6 THEN NULL ELSE date_trunc('day', NOW()) + make_interval(days => $5) + interval '14 hours 45 minutes' END,
                 $7, $8,
                 CASE WHEN $9 THEN date_trunc('day', NOW()) + make_interval(days => $5) + interval '15 hours' ELSE NULL END,
                 NOW() - make_interval(days => GREATEST(-$5, 0) + 1),
                 NOW() - make_interval(days => GREATEST(-$5, 0)))
         RETURNING id`,
        [projectId, m.title, m.description, planned ? 'planned' : 'done',
         planned ? m.daysFromNow : -m.daysAgo, planned,
         analyzed ? 'done' : 'none', analyzed ? 'done' : 'none', analyzed]
      );
      const meetingId = mr.rows[0].id;
      counts.meetings++;

      await client.query(
        `INSERT INTO participants (meeting_id, user_id, display_name, role) VALUES ($1, $2, $3, 'host')`,
        [meetingId, userIds[m.host], users[m.host].name]
      );
      for (const a of m.attendees) {
        await client.query(
          `INSERT INTO participants (meeting_id, user_id, display_name, role) VALUES ($1, $2, $3, 'attendee')`,
          [meetingId, userIds[a], users[a].name]
        );
      }

      if (m.transcription) {
        await client.query(
          `INSERT INTO transcriptions (meeting_id, raw_text, language) VALUES ($1, $2, 'fr')`,
          [meetingId, m.transcription]
        );
      }

      // Projet créé par l'analyse de cette réunion : l'organisateur en est propriétaire,
      // les acteurs qui y reçoivent une tâche en deviennent membres (comme le pipeline)
      const projectIdsByKey = {};
      if (m.createsProject) {
        const np = m.createsProject;
        const created = await client.query(
          `INSERT INTO projects (name, description, owner_id, source_meeting_id) VALUES ($1, $2, $3, $4) RETURNING id`,
          [np.name, np.description, userIds[m.host], meetingId]
        );
        projectIdsByKey[np.key] = created.rows[0].id;
        counts.projects++;
        await addMember(created.rows[0].id, m.host, 'owner');
        for (const key of np.members) await addMember(created.rows[0].id, key, 'member');
      }
      const projectOf = (item) => (item.project ? projectIdsByKey[item.project] : projectId);

      const insertedDecisions = [];
      for (const d of m.decisions || []) {
        const dr = await client.query(
          `INSERT INTO decisions (meeting_id, project_id, content, context, responsible, alternatives, confidence, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                   NOW() - make_interval(days => $9) + interval '1 hour',
                   NOW() - make_interval(days => $9) + interval '1 hour')
           RETURNING id, content, context, responsible`,
          [meetingId, projectOf(d), d.content, d.context, d.responsible, d.alternatives, d.confidence, d.status, m.daysAgo ?? 0]
        );
        decisionIds[d.ref] = dr.rows[0].id;
        insertedDecisions.push(dr.rows[0]);
        counts.decisions++;

        if (d.contradicts) {
          await client.query(
            `INSERT INTO alerts (new_decision_id, conflict_decision_id, project_id, explanation, severity)
             VALUES ($1, $2, $3, $4, $5)`,
            [decisionIds[d.ref], decisionIds[d.contradicts.ref], projectOf(d), d.contradicts.explanation, d.contradicts.severity]
          );
          counts.alerts++;
        }
      }

      // Tâches identiques à celles de l'analyse : source « ai », acteur lié à son compte,
      // créées au nom de l'organisateur de la réunion
      const tasksByActor = {};
      for (const t of m.tasks || []) {
        await client.query(
          `INSERT INTO tasks (title, assignee, assignee_id, priority, status, meeting_id, project_id,
                              due_date, due_estimated, source, user_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ai', $10)`,
          [t.title, users[t.assignee].name, userIds[t.assignee], t.priority, t.status, meetingId, projectOf(t),
           await dueDate(t.dueInDays), Boolean(t.estimated), userIds[m.host]]
        );
        counts.tasks++;
        tasksByActor[t.assignee] = (tasksByActor[t.assignee] ?? 0) + 1;
      }

      for (const r of m.risks || []) {
        await client.query(
          `INSERT INTO mtg_risks (project_id, meeting_id, kind, description, severity, mitigation) VALUES ($1, $2, $3, $4, $5, $6)`,
          [projectId, meetingId, r.kind, r.description, r.severity, r.mitigation]
        );
        counts.risks++;
      }

      // Journal des courriels, comme en mode console : un par acteur + un résumé pour l'organisateur
      if (analyzed) {
        const subject = `Veridian — ${m.title}`;
        for (const [key, n] of Object.entries(tasksByActor)) {
          await client.query(
            `INSERT INTO mtg_notifications (meeting_id, user_id, email, subject, kind, status) VALUES ($1, $2, $3, $4, 'actor', 'logged')`,
            [meetingId, userIds[key], users[key].email, `${subject} : ${n} tâche(s) pour vous`]
          );
          counts.emails++;
        }
        await client.query(
          `INSERT INTO mtg_notifications (meeting_id, user_id, email, subject, kind, status) VALUES ($1, $2, $3, $4, 'summary', 'logged')`,
          [meetingId, userIds[m.host], users[m.host].email,
           `${subject} : résumé (${(m.tasks || []).length} tâche(s), ${(m.decisions || []).length} décision(s))`]
        );
        counts.emails++;
        indexable.push({ meetingId, projectId, text: m.transcription, decisions: insertedDecisions });
      }
    }
  }

  return { counts, indexable };
};

// Mémoire vectorielle (recherche et chat) : nécessite la clé Gemini. Jamais bloquant.
const indexMemory = async (indexable, { withEmbeddings, log }) => {
  if (!withEmbeddings) { log('Mémoire vectorielle ignorée (--no-embeddings).'); return 0; }
  if (!process.env.GEMINI_API_KEY) { log('Pas de clé GEMINI_API_KEY : mémoire vectorielle non indexée.'); return 0; }

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
  return ok;
};

/**
 * Ajoute les données de test dans la base de `pool`, dans une seule transaction.
 * @returns {{ created: boolean, counts?: object, indexed?: number }} created = false si elles existaient déjà
 */
export async function seedTestData(pool, { withEmbeddings = true, log = (msg) => console.log(`[Données de test] ${msg}`) } = {}) {
  const existing = await pool.query('SELECT 1 FROM users WHERE LOWER(email) = $1', [SEED_USERS[0].email]);
  if (existing.rowCount > 0) {
    log('Déjà présentes dans la base : rien à faire.');
    return { created: false };
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
  log(`${SEED_USERS.length} comptes, ${c.projects} projets, ${c.meetings} réunions, ${c.decisions} décisions, ${c.alerts} alertes, ${c.risks} risques, ${c.tasks} tâches, ${c.emails} courriels journalisés.`);
  const indexed = await indexMemory(result.indexable, { withEmbeddings, log });
  return { created: true, counts: c, indexed };
}

// ─── Lancement direct : node database/seed.js ────────────────────────────────
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { default: pool } = await import('../src/config/db.js');
  console.log('');
  console.log('=== DONNÉES DE TEST (facultatives) — comptes et projets fictifs ===');
  seedTestData(pool, { withEmbeddings: !process.argv.includes('--no-embeddings') })
    .then((result) => {
      if (!result.created) return;
      console.log('');
      console.log(`[Données de test] Comptes fictifs (mot de passe : ${SEED_PASSWORD}) :`);
      for (const u of SEED_USERS) console.log(`[Données de test]   ${u.email.padEnd(30)} ${u.role}`);
    })
    .catch((error) => {
      console.error('[Données de test] Échec :', error.message);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
