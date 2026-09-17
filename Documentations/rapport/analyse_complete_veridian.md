# Analyse complète du projet Veridian
## Document d'analyse — INF4018 — Francis Côté

---

## 1. Problème à résoudre

### 1.1 Contexte

Les organisations modernes tiennent des réunions d'équipe régulières pour prendre des décisions importantes. Ces décisions représentent la mémoire stratégique de l'organisation — elles guident les actions futures, définissent les orientations techniques, et établissent des engagements entre les parties prenantes.

### 1.2 Problème identifié

La gestion de cette mémoire décisionnelle est défaillante dans la grande majorité des organisations, particulièrement dans les PME et startups qui n'ont pas les ressources pour maintenir une documentation rigoureuse.

**Trois problèmes fondamentaux :**

**Problème 1 — Perte d'informations décisionnelles**
Les décisions prises en réunion ne sont jamais formellement documentées de façon structurée. Les comptes rendus manuels sont partiels, subjectifs, rédigés longtemps après la réunion, et rarement consultés. Une étude de Harvard Business Review (2017) indique que les professionnels passent en moyenne 23 heures par semaine en réunion, dont une proportion significative est consacrée à retrouver ou valider des informations déjà traitées.

**Problème 2 — Absence de mémoire organisationnelle**
Il est impossible de retracer pourquoi une décision a été prise plusieurs semaines après les faits, quelles alternatives ont été considérées, et qui en était responsable. Cette absence de traçabilité génère des conflits, des retards, et des coûts inutiles.

**Problème 3 — Contradictions non détectées**
Des décisions contradictoires sont régulièrement prises lors de réunions successives, faute d'accès à l'historique décisionnel. Ces contradictions ne sont découvertes que lorsqu'elles causent des problèmes concrets — trop tard pour les corriger sans impact.

---

## 2. Solutions disponibles sur le marché

### 2.1 Analyse comparative des solutions existantes

| Solution | Transcription | Résumé | Décisions structurées | Mémoire organisationnelle | Détection contradictions | Chat historique |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Otter.ai | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Fireflies.ai | ✓ | ✓ | Partiel | ✗ | ✗ | ✗ |
| MeetMind | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Notion AI | ✗ | ✓ | ✗ | Partiel | ✗ | Partiel |
| Microsoft Copilot | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Veridian** | **✓** | **✓** | **✓** | **✓** | **✓** | **✓** |

### 2.2 Lacunes des solutions existantes

Toutes les solutions du marché se concentrent sur la transcription et le résumé — elles ne traitent pas le problème fondamental de la **mémoire organisationnelle structurée** et de la **détection de contradictions**. Aucune solution disponible ne combine ces capacités dans une interface unifiée.

---

## 3. Solution choisie — Veridian

### 3.1 Description de la solution

Veridian est une application web complète qui automatise la capture, la structuration et la gestion de la mémoire décisionnelle des équipes. Elle se distingue par trois capacités uniques :

1. **Extraction structurée des décisions** : chaque décision est un objet persistant avec son contenu, contexte, alternatives rejetées et responsable
2. **Mémoire vectorielle RAG** : recherche sémantique en langage naturel sur l'historique décisionnel
3. **Détection proactive des contradictions** : alerte automatique quand une nouvelle décision contredit une décision passée

### 3.2 Adéquation au besoin client

| Besoin client | Réponse Veridian |
|---|---|
| Ne plus perdre les décisions de réunion | Extraction automatique et persistance en base de données |
| Retrouver le contexte d'une décision passée | Chat RAG en langage naturel sur l'historique |
| Éviter les décisions contradictoires | Détection automatique avec citation de la source conflictuelle |
| Aucune installation côté utilisateur | Enregistrement audio directement dans le navigateur |
| Accessible à toute l'équipe | Gestion multi-utilisateurs avec rôles et permissions |

### 3.3 Stack technologique justifiée

| Composant | Technologie | Justification |
|---|---|---|
| Backend | Node.js 20 + Express 5 | Écosystème JS unifié, excellent I/O asynchrone pour les appels IA |
| Frontend | React 18 + Vite | Composants réutilisables, performances de développement supérieures |
| Base de données | PostgreSQL 16 + pgvector | Données relationnelles + embeddings vectoriels dans un seul système |
| Transcription | OpenAI Whisper (local) | Gratuit, même modèle qu'OpenAI API, support multilingue |
| IA / NLP | Google Gemini 1.5 Flash | Tier gratuit généreux (1M tokens/jour), excellente extraction JSON |
| Recherche vectorielle | pgvector + HNSW | Index rapide O(log n) intégré à PostgreSQL |
| Authentification | JWT | Standard REST stateless, pas de session serveur |
| Conteneurisation | Docker + Compose | Reproductibilité cross-platform Windows/Ubuntu |

---

## 4. Acteurs du système

### 4.1 Acteurs principaux

**Utilisateur (membre d'équipe)**
- Rôle : participant régulier aux réunions
- Actions : créer des réunions, enregistrer l'audio, consulter les décisions, interroger la mémoire via le chat, exporter les rapports PDF
- Niveau d'accès : projets dont il est membre

**Administrateur (propriétaire de projet)**
- Rôle : gestionnaire d'équipe
- Actions : toutes les actions utilisateur + créer des projets, inviter des membres, gérer les rôles, changer les statuts
- Niveau d'accès : tous ses projets

**Système IA (acteur technique)**
- Rôle : traitement automatique
- Actions : transcrire l'audio (Whisper), extraire les décisions (Gemini), générer les embeddings, détecter les contradictions
- Déclenchement : automatique après upload audio

### 4.2 Acteurs secondaires

**Superviseur académique**
- Accès en lecture au dépôt GitHub public
- Suivi de la progression via GitHub Projects

---

## 5. Opérations disponibles

### 5.1 Gestion des utilisateurs
- S'inscrire (créer un compte)
- Se connecter (obtenir un token JWT)
- Consulter son profil
- Modifier ses informations

### 5.2 Gestion des projets
- Créer un projet
- Lister ses projets
- Consulter un projet
- Modifier un projet (nom, description)
- Changer le statut (active, archived, inactive)
- Inviter un membre
- Modifier le rôle d'un membre

### 5.3 Gestion des réunions
- Créer une réunion
- Lister les réunions d'un projet
- Consulter une réunion
- Démarrer l'enregistrement
- Arrêter l'enregistrement
- Changer le statut (planned, active, processing, done, cancelled)

### 5.4 Transcription
- Uploader un fichier audio
- Déclencher la transcription Whisper
- Consulter la transcription
- Corriger manuellement la transcription

### 5.5 Décisions
- Déclencher l'extraction des décisions (Gemini)
- Consulter les décisions d'une réunion
- Consulter toutes les décisions d'un projet
- Confirmer ou invalider une décision

### 5.6 Mémoire vectorielle (RAG)
- Générer les embeddings d'une décision
- Rechercher sémantiquement dans l'historique
- Interroger la mémoire via le chat

### 5.7 Alertes
- Détecter automatiquement les contradictions
- Consulter les alertes d'un projet
- Résoudre une alerte

### 5.8 Export
- Exporter le rapport PDF d'une réunion

---

## 6. Séquences d'opérations principales

### 6.1 Séquence — Enregistrement et transcription d'une réunion

```
1. Utilisateur crée une réunion → POST /api/meetings
2. Système crée la réunion (status: planned) + ajoute l'utilisateur comme host
3. Utilisateur démarre l'enregistrement → PATCH /api/meetings/:id/status {status: active}
4. Navigateur capture l'audio via MediaRecorder API
5. Utilisateur arrête l'enregistrement
6. Frontend envoie le fichier audio → POST /api/transcriptions/upload
7. Multer reçoit et sauvegarde le fichier audio temporaire
8. Whisper transcrit l'audio → texte brut
9. Fichier audio supprimé du serveur
10. Transcription sauvegardée en BD → status meeting: processing
11. Utilisateur voit la transcription brute et peut la corriger
```

### 6.2 Séquence — Extraction et vectorisation des décisions

```
1. Utilisateur déclenche l'extraction → POST /api/decisions/extract/:transcriptionId
2. ia.service.extractDecisions() envoie la transcription à Gemini
3. Gemini retourne un tableau JSON de décisions structurées
4. Pour chaque décision :
   a. Sauvegardée en BD (table decisions)
   b. Embeddings générés via Gemini embedding-001
   c. Vecteur sauvegardé dans pgvector (table memory_chunks)
   d. Détection de contradiction lancée
5. Status meeting mis à done
6. Dashboard des décisions affiché
```

### 6.3 Séquence — Détection de contradiction

```
1. Nouvelle décision extraite
2. contradiction.service() vectorise la nouvelle décision
3. pgvector recherche les 5 décisions les plus similaires (similarité cosinus)
4. Si similarité > seuil (0.85) :
   a. Gemini évalue le niveau de contradiction
   b. Si contradiction confirmée :
      - Alerte créée en BD (table alerts)
      - Sévérité assignée (low, medium, high)
      - Notification in-app envoyée
      - Status décision conflictuelle → contradicted
5. Alerte affichée dans le dashboard
```

### 6.4 Séquence — Chat mémoire (RAG)

```
1. Utilisateur pose une question → POST /api/chat
2. Question vectorisée via Gemini embedding-001
3. pgvector recherche les 5 décisions les plus similaires
4. Contexte construit avec les décisions trouvées
5. Question + contexte envoyés à Gemini
6. Gemini génère une réponse conversationnelle avec citations
7. Réponse affichée avec les sources référencées
```

---

## 7. Plan de réalisation

### 7.1 Méthodologie

**Approche** : Agile Scrum adapté (développeur unique)
- Sprints de 2 semaines
- Livraison par blocs fonctionnels indépendants
- Pull Request obligatoire pour chaque bloc
- Application fonctionnelle à tout moment

### 7.2 Blocs de développement

| Bloc | Titre | Statut |
|---|---|---|
| Bloc 01 | Infrastructure & Base de données | ✅ Complété |
| Bloc 02 | Authentification JWT | ✅ Complété |
| Bloc 03 | Module Projets (CRUD) | ✅ Complété |
| Bloc 04 | Module Réunions (CRUD) | ✅ Complété |
| Bloc 05 | Transcription Audio (Whisper) | ✅ Complété |
| Bloc 06 | Extraction des décisions (Gemini) | 🔵 En cours |
| Bloc 07 | Mémoire vectorielle (RAG) | ⬜ À faire |
| Bloc 08 | Détection contradictions & Alertes | ⬜ À faire |
| Bloc 09 | Chat mémoire & Export PDF | ⬜ À faire |
| Bloc 10 | Frontend Auth (React/Vite) | ⬜ À faire |
| Bloc 11 | Frontend Dashboard | ⬜ À faire |
| Bloc 12 | Frontend IA | ⬜ À faire |
| Bloc 13 | Tests d'intégration | ⬜ À faire |
| Bloc 14 | Déploiement & Documentation finale | ⬜ À faire |

### 7.3 Calendrier — 14 semaines restantes

| Semaines | Blocs | Livrables |
|---|---|---|
| S1 – S2 | Bloc 06 | Extraction décisions Gemini opérationnelle |
| S3 – S4 | Bloc 07 | Mémoire vectorielle RAG fonctionnelle |
| S5 – S6 | Bloc 08 | Détection contradictions et alertes |
| S7 – S8 | Bloc 09 | Chat mémoire et export PDF |
| S9 – S10 | Blocs 10-11 | Frontend Auth + Dashboard |
| S11 – S12 | Bloc 12 | Frontend IA (décisions, alertes, chat) |
| S13 | Bloc 13 | Tests d'intégration et qualité |
| S14 | Bloc 14 | Déploiement + Documentation finale + TN4 |

### 7.4 Liste complète des tâches (de 0 à la fin)

#### Infrastructure (✅ Complété)
- [x] Installation Git, Node.js, Docker, VS Code
- [x] Configuration GitHub avec Personal Access Token
- [x] Création du dépôt GitHub
- [x] Structure des dossiers du projet
- [x] Fichier .gitignore
- [x] Docker Compose + PostgreSQL 16 + pgvector
- [x] Schéma SQL complet (9 tables, 17 index)
- [x] Configuration des variables d'environnement

#### Backend — Fondations (✅ Complété)
- [x] Initialisation package.json avec ES Modules
- [x] Installation Express, pg, dotenv, bcryptjs, jsonwebtoken
- [x] Configuration Nodemon
- [x] Fichier app.js (serveur Express)
- [x] Fichier server.js (démarrage avec testConnection)
- [x] Module de connexion PostgreSQL (Pool + query + withTransaction)
- [x] Utilitaire hash bcrypt (hashPassword, comparePassword)
- [x] Utilitaire JWT (generateToken, verifyToken)

#### Authentification (✅ Complété)
- [x] Modèle User (findUserByEmail, findUserById, createUser)
- [x] Contrôleur Auth (register, login)
- [x] Routes Auth (/register, /login)
- [x] Middleware Auth JWT
- [x] Middleware gestion erreurs globale
- [x] Tests unitaires hash.utils (5 tests)
- [x] Tests unitaires jwt.utils (6 tests)
- [x] Configuration Jest + dotenv-cli

#### Module Projets (✅ Complété)
- [x] Modèle Project (createProjectWithOwner, findProjectsByUser, findProjectById, updateProject, updateProjectStatus)
- [x] Modèle ProjectMember (addProjectMember privé)
- [x] Contrôleur Project (5 handlers)
- [x] Routes Project (5 endpoints)
- [x] Transactions atomiques (projet + membre en une seule transaction)

#### Module Réunions (✅ Complété)
- [x] Modèle Meeting (createMeetingWithHost, findMeetingsByProject, findMeetingById, updateMeetingStatus)
- [x] Modèle Participant (addMeetingParticipant privé)
- [x] Contrôleur Meeting (4 handlers)
- [x] Routes Meeting (4 endpoints)

#### Module Transcription (✅ Complété)
- [x] Installation Whisper local (Python)
- [x] Configuration Gemini API (gratuit)
- [x] Middleware upload Multer (validation MIME, nom unique)
- [x] Service Whisper (spawn CPU, gestion erreurs)
- [x] Modèle Transcription (createTranscription, findTranscriptionByMeeting, updateTranscriptionText)
- [x] Contrôleur Transcription (upload+transcribe, get, update)
- [x] Routes Transcription (3 endpoints)
- [x] Migration pgvector vector(768)
- [x] Configuration nodemon.json (ignore uploads)

#### Module Décisions (🔵 En cours)
- [ ] Service IA — extractDecisions() dans ia.service.js
- [ ] Modèle Decision (createDecision, findDecisionsByMeeting, findDecisionsByProject)
- [ ] Contrôleur Decision (extract, list, get)
- [ ] Routes Decision (3 endpoints)
- [ ] Intégration post-transcription automatique

#### Module Mémoire Vectorielle — RAG (⬜ À faire)
- [ ] Service Embedding (generateEmbedding via Gemini)
- [ ] Modèle MemoryChunk (createChunk, searchSimilar)
- [ ] Service RAG (buildContext, search)
- [ ] Contrôleur Memory (search)
- [ ] Routes Memory (1 endpoint)

#### Module Contradictions & Alertes (⬜ À faire)
- [ ] Service Contradiction (detectContradiction dans ia.service.js)
- [ ] Modèle Alert (createAlert, findAlertsByProject, resolveAlert)
- [ ] Contrôleur Alert (list, resolve)
- [ ] Routes Alert (2 endpoints)

#### Module Chat & Export (⬜ À faire)
- [ ] Service Chat RAG (chatWithMemory dans ia.service.js)
- [ ] Contrôleur Chat (chat)
- [ ] Routes Chat (1 endpoint)
- [ ] Service PDF (pdfkit — generateReport)
- [ ] Contrôleur Export (exportPDF)
- [ ] Routes Export (1 endpoint)

#### Frontend React (⬜ À faire)
- [ ] Initialisation Vite + React 18
- [ ] Installation React Router, Axios, Zustand, TailwindCSS
- [ ] Configuration api.js (instance Axios + intercepteurs JWT)
- [ ] Store Zustand (authStore, projectStore)
- [ ] Page Login.jsx
- [ ] Page Register.jsx
- [ ] Routes protégées (PrivateRoute)
- [ ] Page Dashboard.jsx (liste projets)
- [ ] Page ProjectDetail.jsx (réunions d'un projet)
- [ ] Page MeetingRoom.jsx (enregistrement audio)
- [ ] Composant AudioRecorder (MediaRecorder API)
- [ ] Page DecisionHistory.jsx
- [ ] Page Alerts.jsx
- [ ] Page MemoryChat.jsx
- [ ] Composant ChatInterface.jsx
- [ ] Bouton Export PDF

#### Tests & Qualité (⬜ À faire)
- [ ] Tests intégration Auth (supertest)
- [ ] Tests intégration Projects
- [ ] Tests intégration Meetings
- [ ] Revue sécurité (injection SQL, CORS, validation)

#### Déploiement & Documentation (⬜ À faire)
- [ ] Déploiement Railway ou Render
- [ ] Variables d'environnement production
- [ ] guide_developpement.md complet
- [ ] How To générique (structure dossiers)
- [ ] journal_bugs.md
- [ ] Rapport TN4
- [ ] Présentation orale

---

## 8. Architecture technique détaillée

### 8.1 Structure du backend

```
Backend/
├── src/
│   ├── config/
│   │   ├── db.js          # Pool PostgreSQL + withTransaction
│   │   └── gemini.js      # Client Gemini API
│   ├── controllers/       # Handlers HTTP (logique métier)
│   ├── services/          # Services externes (IA, PDF, email)
│   ├── routes/            # Endpoints API REST
│   ├── middlewares/       # Auth, upload, erreurs
│   ├── models/            # Requêtes SQL par entité
│   └── utils/             # Fonctions utilitaires
├── database/
│   ├── schema.sql         # Schéma initial
│   └── migrations/        # Modifications versionnées
├── tests/
│   ├── unit/              # Tests unitaires (Jest)
│   └── integration/       # Tests d'intégration (Supertest)
├── app.js                 # Configuration Express
└── server.js              # Point d'entrée
```

### 8.2 Modèle de données

**9 tables relationnelles :**

| Table | Description | Relations |
|---|---|---|
| users | Comptes utilisateurs | Propriétaire de projects, membre de project_members |
| projects | Projets d'équipe | Appartient à users, contient meetings |
| project_members | Membres d'un projet | Joint users et projects (N:N) |
| meetings | Réunions | Appartient à projects, contient transcriptions |
| participants | Participants d'une réunion | Joint users et meetings |
| transcriptions | Texte transcrit | 1:1 avec meetings |
| decisions | Décisions extraites | Appartient à meetings et projects |
| memory_chunks | Embeddings vectoriels | 1:1 avec decisions |
| alerts | Alertes de contradiction | Relie deux decisions |

### 8.3 Principes architecturaux appliqués

- **Séparation des responsabilités** : Model → Controller → Route → App
- **Transactions atomiques** : `withTransaction()` pour toute opération multi-tables
- **Soft delete** : jamais de DELETE SQL dans le code applicatif
- **Sécurité au niveau des données** : filtrage par userId dans chaque requête
- **Injection de dépendances** : variables d'environnement externalisées
- **Requêtes paramétrées** : protection contre les injections SQL

---

## 9. Risques et mitigation

| Risque | Probabilité | Impact | Mitigation |
|---|:---:|:---:|---|
| Manque de temps (disponibilité limitée) | Élevée | Élevé | Blocs indépendants, fonctionnalités P2 différables |
| Qualité transcription insuffisante | Moyenne | Élevé | Interface correction manuelle avant extraction |
| Précision extraction Gemini faible | Moyenne | Moyen | Itérations prompt engineering, validation humaine |
| Quota API Gemini dépassé | Faible | Moyen | Mode mock pour développement, monitoring quotidien |
| Complexité RAG sous-estimée | Moyenne | Élevé | Prototype dès Bloc 07, sprint tampon disponible |

---

*Veridian — Analyse complète — INF4018 — Francis Côté*
