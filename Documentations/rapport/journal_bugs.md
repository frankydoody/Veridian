# Journal des bugs — Veridian

Chaque bug, erreur ou problème rencontré pendant le développement, même petit.
Les entrées sont numérotées dans l'ordre où elles ont été consignées ; le bloc
indique quand le problème a été rencontré et corrigé.

Format : symptôme (ce qu'on voyait) → cause (la vraie raison) → correction →
test (comment on s'assure qu'il ne revient pas) → leçon.

---

### BUG-01 — Caractère emoji transformé en deux « ? » dans le PDF
- **Bloc** : 09
- **Symptôme** : un emoji dans une décision ou un titre de réunion apparaissait sous la forme « ?? » dans le rapport PDF exporté, au lieu d'un seul « ? ».
- **Cause** : la police intégrée de `pdfkit` ne contient pas les emojis, qui sont remplacés par « ? ». Or un emoji est codé en JavaScript par **deux** unités UTF-16 (une « paire de substitution »). Sans le drapeau `u`, l'expression régulière traitait chaque moitié séparément et produisait deux remplacements.
- **Correction** : `toPdfText` dans `src/services/pdf.service.js` utilise des expressions régulières avec le drapeau `u` (Unicode) : un emoji est un seul caractère, donc un seul « ? ».
- **Test** : `tests/unit/pdf.service.test.js`, test « remplace les caractères non supportés » : `toPdfText('Go 🚀 →')` doit donner `'Go ? ?'` (un seul « ? » pour l'emoji).
- **Leçon** : en JavaScript, `"😀".length` vaut 2. Toute expression régulière qui manipule des caractères hors du plan de base (emojis, certains symboles) a besoin du drapeau `u`.

### BUG-02 — `inconsistent types deduced for parameter $2` (PostgreSQL)
- **Bloc** : 19
- **Symptôme** : l'enregistrement de l'état d'analyse d'une réunion échouait avec l'erreur PostgreSQL `inconsistent types deduced for parameter $2`. Les tests unitaires, eux, passaient.
- **Cause** : dans `setAnalysisStatus`, le même paramètre `$2` servait à la fois à remplir la colonne `analysis_status` (de type `varchar`) et à une comparaison `$2 = 'done'` (que PostgreSQL déduit comme `text`). PostgreSQL refuse de donner deux types à un même paramètre.
- **Correction** : types explicites dans `src/models/pipeline.model.js` : `$2::varchar` pour l'affectation, `$2::text` pour la comparaison.
- **Test** : le scénario sur vraie base `tests/integration/pipeline.it.mjs` exécute réellement la requête.
- **Leçon** : les mocks ne voient jamais les erreurs SQL, puisque la requête n'est pas exécutée. Toute requête SQL nouvelle doit passer au moins une fois contre une vraie base.

### BUG-03 — Date de fin d'une tâche décalée d'un jour
- **Bloc** : 19
- **Symptôme** : une tâche « à remettre le 12 novembre » s'affichait « 11 novembre » dans l'interface.
- **Cause** : une date sans heure (`2026-11-12`) est interprétée par JavaScript comme **minuit UTC**. Au Québec (UTC−5 ou UTC−4), minuit UTC correspond encore à la veille au soir, et l'affichage en heure locale reculait donc d'un jour.
- **Correction** : `src/utils/analysis.utils.js` fixe toute date sans heure à **17 h UTC**, ce qui tombe le même jour calendaire dans tous les fuseaux des Amériques et de l'Europe. Les courriels formatent la date en UTC.
- **Test** : `tests/unit/analysis.utils.test.js` vérifie qu'une date `AAAA-MM-JJ` devient `AAAA-MM-JJT17:00:00Z`.
- **Leçon** : une « date » sans heure n'existe pas pour `Date` en JavaScript : c'est toujours un instant précis. Il faut choisir cet instant volontairement.

### BUG-04 — `.catch` appelé sur une valeur qui n'est pas une promesse
- **Bloc** : 19
- **Symptôme** : `TypeError: ... .catch is not a function` dans un test du pipeline.
- **Cause** : le code lançait une étape secondaire avec `fonction().catch(...)`. Dans le test, la fonction simulée (mock) renvoyait `undefined` au lieu d'une promesse, et `.catch` n'existe pas sur `undefined`. En production, une future version synchrone de la fonction aurait eu le même problème.
- **Correction** : remplacement par un bloc `try { await fonction() } catch (e) { ... }`, qui fonctionne qu'on reçoive une promesse ou une valeur ordinaire.
- **Test** : `tests/unit/meeting-pipeline.service.test.js`.
- **Leçon** : `await` accepte n'importe quelle valeur, alors que `.catch` exige une promesse. Le style `try/await/catch` est plus robuste.

### BUG-05 — `node_modules` installé sous Windows inutilisable depuis Linux
- **Bloc** : 19
- **Symptôme** : sous Linux (ou WSL), avec le même dossier `node_modules` qu'à l'installation sous Windows, `npm test` échouait car `.bin/jest` était introuvable ou non exécutable.
- **Cause** : npm génère les raccourcis de `node_modules/.bin` selon le système où il a été lancé : fichiers `.cmd` et `.ps1` sous Windows, liens symboliques exécutables sous Linux.
- **Correction** : lancer Jest par son vrai point d'entrée JavaScript, `node node_modules/jest/bin/jest.js`. Le script `npm test` le fait désormais (voir BUG-08).
- **Test** : `npm test` sous Windows ; sous Linux, `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand`.
- **Leçon** : `node_modules` dépend du système. On le réinstalle avec `npm install` sur chaque machine et on ne le copie jamais d'un système à l'autre.

### BUG-06 — Installateur Linux : plusieurs défauts de `start.sh`
- **Bloc** : correctif d'installation (branche `fix/installation-linux`)
- **Symptôme** : `./start.sh --help` lançait l'installation au lieu d'afficher l'aide ; l'arrêt des serveurs ne trouvait pas le bon processus ; Whisper ne s'installait pas avec Python 3.13 ; la commande `whisper` restait introuvable après son installation.
- **Cause** : l'analyse des options ne reconnaissait pas `--help` ; le PID enregistré était celui de l'intermédiaire `setsid`, pas celui du serveur ; certaines dépendances de Whisper ne publient pas encore de paquet pour Python 3.13 ; `pip install --user` installe dans `~/.local/bin`, qui n'est pas dans le `PATH` par défaut.
- **Correction** : `start.sh` réécrit : options analysées avant toute action, capture du PID réel, choix d'une version de Python compatible, ajout de `~/.local/bin` au `PATH`.
- **Test** : `./start.sh --help`, puis `./start.sh --install-only` sur Ubuntu.
- **Leçon** : un script d'installation doit être testé sur une machine propre, en échouant tôt avec un message clair plutôt qu'au milieu du travail.

### BUG-07 — Faux fichiers modifiés dans Git (fins de ligne CRLF/LF)
- **Bloc** : hygiène du dépôt (avant le bloc 12)
- **Symptôme** : `git status` affichait des fichiers modifiés que personne n'avait touchés ; `git diff` montrait chaque ligne supprimée puis ajoutée à l'identique.
- **Cause** : quatre fichiers (`.gitignore`, `Demarrer.bat`, `package.json` et `package-lock.json` du backend) étaient enregistrés avec des fins de ligne Windows (CRLF), alors que le reste du dépôt était en LF. Avec `core.autocrlf=true`, Git convertit les fins de ligne à chaque lecture et écriture, et il voyait une différence.
- **Correction** : ajout d'un `.gitattributes` (`* text=auto eol=lf`, `*.bat`/`*.cmd`/`*.ps1` en CRLF, binaires sans conversion), puis renormalisation **de ces quatre fichiers seulement**, dans un commit séparé (`git add --renormalize -- <fichiers>`). Avant ce correctif, on contournait le problème en ajoutant les fichiers un par un plutôt qu'avec `git add -A`.
- **Test** : `git diff --cached --ignore-cr-at-eol` était vide (seules les fins de ligne changeaient) ; `git status` ne montre plus de faux fichiers modifiés ; `git ls-files --eol` affiche `i/lf` pour ces fichiers.
- **Complément (bloc 12)** : deux autres fichiers, `tests/api.http` et `src/models/decision.model.js`, avaient des fins de ligne **mélangées** (CRLF et LF dans le même fichier). La première recherche ne visait que `i/crlf` et les avait ratés. Ils ont été renormalisés au bloc 12. La bonne commande de détection liste tout ce qui n'est pas du LF pur : `git ls-files --eol | awk '$1 !~ /^i\/(lf|none|-text)$/'` (résultat vide attendu).
- **Leçon** : un `.gitattributes` fixe la règle **dans le dépôt**, pour toutes les machines, alors que `core.autocrlf` dépend de la configuration de chacun. Pour détecter un problème, mieux vaut chercher « tout ce qui n'est pas correct » plutôt qu'« un cas incorrect connu ».

### BUG-08 — `npm test` ne démarre pas sous Windows
- **Bloc** : hygiène du dépôt (avant le bloc 12)
- **Symptôme** : `npm test` s'arrêtait immédiatement avec `SyntaxError: missing ) after argument list` sur la ligne `basedir=$(dirname "$(echo "$0" | sed -e 's,\\,/,g')")`.
- **Cause** : le script exécutait `node node_modules/.bin/jest`. Sous Windows, ce fichier est un script *shell* (`#!/bin/sh`) généré par npm pour les systèmes Unix. Node essayait de le lire comme du JavaScript.
- **Correction** : `package.json` (scripts `test` et `test:watch`) appelle `node_modules/jest/bin/jest.js`, le vrai programme JavaScript de Jest.
- **Test** : `cd Projet\Backend; npm test` affiche toutes les suites au vert.
- **Leçon** : `node <fichier>` exige un fichier JavaScript. Les fichiers de `.bin/` sont des raccourcis pour le terminal, pas pour `node`.

### BUG-09 — Documentation décrivant des services d'IA qui ne sont plus utilisés
- **Bloc** : hygiène du dépôt (avant le bloc 12)
- **Symptôme** : le guide de développement, `SETUP_MACHINES.md` et un commentaire de `.gitignore` demandaient des clés OpenAI et d'un autre fournisseur, alors que l'application n'utilise que Gemini (et Whisper en local).
- **Cause** : ces textes dataient de la première maquette ; ils n'avaient pas été mis à jour lors du passage à Gemini.
- **Correction** : textes corrigés (Gemini pour l'analyse, Whisper exécuté localement pour la transcription).
- **Test** : `git grep -n -i "api_key"` ne montre que `GEMINI_API_KEY`.
- **Leçon** : la documentation fait partie du code. Elle se met à jour dans le même bloc que le changement qu'elle décrit.

### BUG-10 — « il y a -2880 min » pour une réunion future
- **Bloc** : 12
- **Symptôme** : dans l'activité récente du tableau de bord, la réunion planifiée affichait « il y a -2880 min ».
- **Cause** : `formatRelative` calculait `maintenant - date` sans prévoir le futur. Pour une réunion prévue dans 2 jours, la différence est négative (−2 880 minutes), donc inférieure à 60, et la fonction tombait dans la branche « minutes ».
- **Correction** : `formatRelative` déplacée dans `Frontend/src/utils/dates.js`. Elle travaille sur la valeur absolue de l'écart et choisit « il y a … » ou « dans … » selon le signe.
- **Test** : `src/utils/dates.test.js`, test « formatRelative : futur » (`npm test` dans `Projet/Frontend`) : une date dans 2 jours donne « dans 2 jours » et ne contient jamais de signe moins.
- **Leçon** : une durée calculée par soustraction peut être négative. Il faut traiter les deux signes, ou les refuser explicitement.

### BUG-11 — Filtres de la page Réunions toujours vides
- **Bloc** : 12
- **Symptôme** : les onglets « En cours » et « Terminées » de la page Réunions n'affichaient jamais rien, et les badges de statut étaient sans couleur.
- **Cause** : la page filtrait sur `in_progress` et `completed`, des valeurs qui n'existent pas dans la base. La contrainte `CHECK` de `meetings.status` n'accepte que `planned`, `active`, `processing`, `done` et `cancelled`. Chaque page tenait sa propre liste de statuts.
- **Correction** : `Frontend/src/utils/labels.js` regroupe les statuts (réunion, analyse, tâche, priorité, gravité) avec les clés exactes de la base. Les pages Réunions et Tableau de bord l'utilisent.
- **Test** : avec les données de test, l'onglet « Terminées » affiche les réunions terminées et « Planifiées » la réunion à venir.
- **Leçon** : une valeur qui vient de la base doit être recopiée depuis la base (contrainte `CHECK`), pas devinée. Une seule liste partagée évite que les pages divergent.

### BUG-12 — Couleurs absentes (variables CSS non définies)
- **Bloc** : 12
- **Symptôme** : badges sans fond, sous-titres de la même couleur que les titres, messages d'erreur sans couleur rouge.
- **Cause** : plusieurs pages utilisaient `var(--color-text-1)`, `var(--color-text-2)`, `var(--color-ai-muted)`, `var(--color-success-muted)`, `var(--color-danger)` et `var(--color-danger-muted)`, qui n'étaient définies nulle part. Le navigateur ignore silencieusement une variable inexistante.
- **Correction** : ces noms sont définis dans `Frontend/src/index.css`, comme alias des couleurs existantes de la palette.
- **Test** : `npm run build`, puis rechercher `--color-text-2` dans `dist/assets/*.css`. Une commande compare la liste des `var(--…)` utilisées dans `src` à celles définies dans `index.css` (voir le guide de développement, bloc 12).
- **Leçon** : une faute de frappe dans une variable CSS ne produit aucune erreur. Il faut la vérifier par une recherche plutôt que d'attendre de la voir à l'écran.

### BUG-13 — Erreurs de chargement invisibles
- **Bloc** : 12
- **Symptôme** : si le backend était arrêté, le tableau de bord affichait « Aucune activité récente » et la page Mémoire une liste de projets vide, comme si tout allait bien.
- **Cause** : les erreurs étaient avalées : `console.error` seulement dans le tableau de bord, `.catch(() => {})` vide dans la page Mémoire.
- **Correction** : état d'erreur affiché dans ces deux pages ; le client API transforme une panne réseau en message clair (« Serveur injoignable… »).
- **Test** : arrêter le backend, recharger la page : le message d'erreur s'affiche.
- **Leçon** : un `catch` vide transforme une panne en donnée fausse (« rien à afficher »). Chaque page distingue trois états : chargement, vide et erreur.

### BUG-14 — Données codées en dur dans l'interface
- **Bloc** : 12
- **Symptôme** : « Bonjour, Francis » pour un utilisateur sans nom, et une pastille « IA active » toujours affichée, même sans clé Gemini.
- **Cause** : valeurs écrites directement dans `DashboardPage.jsx` et `Layout.jsx` pendant la maquette.
- **Correction** : le prénom vient uniquement de l'utilisateur connecté. Le composant `ServiceStatus` lit l'état réel des services dans `GET /api/health`.
- **Test** : retirer `GEMINI_API_KEY` du `.env` et relancer le backend : la pastille devient « IA non configurée ».
- **Leçon** : une maquette qui ment (« IA active ») est pire que pas d'indicateur. Elle cache précisément la panne qu'on cherche.

### BUG-15 — Identifiant mal formé : erreur 500 au lieu de 400
- **Bloc** : 13
- **Symptôme** : `GET /api/projects/abc` (ou une réunion, une tâche) répondait `500 Erreur interne du serveur`.
- **Cause** : l'identifiant était envoyé tel quel à PostgreSQL, qui refuse une chaîne qui n'est pas un UUID (`invalid input syntax for type uuid`, code `22P02`). L'erreur remontait jusqu'au gestionnaire d'erreurs générique.
- **Correction** : `isUuid` dans `src/utils/validation.utils.js`, vérifié au début des contrôleurs de projets, de réunions, de tâches et de membres : réponse 400 sans appel à la base.
- **Test** : `tests/unit/forms.controller.test.js` et `tests/unit/task.controller.test.js` (« identifiant invalide → 400 », sans appel au modèle).
- **Leçon** : une entrée invalide est une erreur du **client** (4xx). Un 500 doit signaler un vrai problème du serveur, sinon les vraies pannes se perdent dans le bruit.

### BUG-16 — Le nom du projet disparaît après avoir coché une tâche
- **Bloc** : 13
- **Symptôme** : sur la page Tâches, cocher une tâche vidait sa colonne « Projet » jusqu'au rechargement de la page.
- **Cause** : `PATCH /api/tasks/:id/status` renvoyait la ligne brute (`RETURNING *`), sans les jointures (`project_name`). La page remplaçait sa ligne par cette version incomplète.
- **Correction** : toutes les routes de tâches renvoient la tâche complète, relue avec `findTaskForUser` (même forme que la liste).
- **Test** : `tests/unit/task.controller.test.js` (« renvoie la tâche complète ») et `tests/integration/formulaires.it.mjs` (vérifie `project_name` après le changement de statut).
- **Leçon** : une même ressource doit avoir la même forme dans toutes les réponses de l'API. Sinon le client doit deviner quels champs sont présents.

### BUG-17 — Suppression d'une tâche : effacement réel et réponse 204 trompeuse
- **Bloc** : 13
- **Symptôme** : `DELETE /api/tasks/:id` répondait toujours 204 (« supprimée »), même pour une tâche inexistante ou appartenant à quelqu'un d'autre ; quand elle réussissait, la ligne était définitivement effacée.
- **Cause** : la requête `DELETE FROM tasks WHERE id = $1 AND user_id = $2` ne vérifiait pas le nombre de lignes touchées, et la table `tasks` n'avait pas de colonne `is_active`, contrairement à la règle de suppression logique du projet.
- **Correction** : migration `011_tasks_suppression_logique.sql` (`tasks.is_active`) ; `deactivateTask` fait un `UPDATE … SET is_active = false` ; le contrôleur répond 404 si la tâche est invisible pour l'utilisateur, 403 s'il n'en est ni le créateur ni le propriétaire du projet ; toutes les lectures excluent les tâches supprimées.
- **Test** : `tests/integration/formulaires.it.mjs` vérifie que la tâche disparaît de la liste **et** que sa ligne existe toujours avec `is_active = false`.
- **Leçon** : vérifier `rowCount` après un `UPDATE` ou un `DELETE`. « Aucune ligne touchée » est une information, pas un succès.

### BUG-18 — Mot de passe de la base affiché dans la console
- **Bloc** : 13
- **Symptôme** : au démarrage du backend, la console affichait `password: 'veridian_pass'` avec les autres paramètres de connexion.
- **Cause** : un `console.log` de débogage dans `src/config/db.js` affichait tout l'objet de configuration.
- **Correction** : la ligne affiche maintenant `utilisateur@hôte:port/base`, sans le mot de passe.
- **Test** : démarrer le backend et vérifier la ligne « Base de données : … ».
- **Leçon** : un journal finit dans des captures d'écran, des rapports et des fichiers partagés. Un secret ne doit jamais y être écrit, même en développement.

### BUG-19 — L'audio d'une réunion n'était jamais conservé
- **Bloc** : 14
- **Symptôme** : impossible d'écouter une réunion : `meetings.audio_path` restait toujours vide.
- **Cause** : `uploadAndTranscribeHandler` supprimait le fichier (`fs.unlinkSync`) dès la fin de la transcription et n'enregistrait jamais son nom.
- **Correction** : le fichier est conservé dans le dossier d'envoi (`src/config/storage.js`, ignoré par Git) ; seul son **nom** est enregistré (`setMeetingAudio`) ; un nouvel envoi supprime l'ancien fichier. `GET /api/meetings/:id/audio` l'envoie après vérification d'appartenance, et `resolveAudioPath` refuse tout chemin qui sortirait du dossier.
- **Test** : `tests/unit/meeting-detail.controller.test.js` (chemins piégés refusés, non-membre 404) et `tests/integration/detail-reunion.it.mjs` (lecture complète 200, lecture partielle `Range` 206, non-membre 404, sans jeton 401).
- **Leçon** : une fonctionnalité annoncée (« lecteur audio ») doit être vérifiée de bout en bout. Ici, la colonne existait, mais rien ne la remplissait.

### BUG-20 — Deuxième envoi audio pour une même réunion : erreur 500
- **Bloc** : 14
- **Symptôme** : envoyer un nouvel enregistrement pour une réunion déjà transcrite répondait `500 Erreur interne du serveur`.
- **Cause** : `transcriptions.meeting_id` est `UNIQUE`. L'envoi audio faisait toujours un `INSERT`, ce qui violait la contrainte (code PostgreSQL `23505`). La route texte (`POST /api/transcriptions/text`) gérait déjà ce cas.
- **Correction** : l'envoi audio met à jour la transcription existante, exactement comme la route texte.
- **Test** : avec une réunion déjà transcrite, envoyer un audio : la transcription est remplacée (réponse 201).
- **Leçon** : deux chemins qui écrivent la même table doivent respecter les mêmes contraintes. Une règle `UNIQUE` en base se traduit par « créer ou mettre à jour » dans le code.

### BUG-21 — « IA active » affiché avec une clé Gemini invalide
- **Bloc** : 14
- **Symptôme** : la pastille de l'en-tête affichait « IA active », mais la modification d'une transcription répondait « la mémoire n'a pas pu être ré-indexée ». La console du backend montrait `[400 Bad Request] API key not valid` (`API_KEY_INVALID`).
- **Cause** : `GET /api/health` vérifie seulement qu'une clé est **présente** dans `.env`, pas qu'elle est **valide**. Le libellé « active » laissait croire le contraire, et le message de ré-indexation ne mentionnait pas la possibilité d'une clé invalide.
- **Correction** : la pastille dit « IA configurée », avec une infobulle qui précise que la validité n'est pas vérifiée ; le message de ré-indexation mentionne une clé invalide et renvoie à la console du backend. La vérification réelle de la clé (appel minimal à Gemini) est prévue dans le script de vérification de l'installation (bloc 18).
- **Test** : avec une clé invalide, modifier une transcription : le message indique la piste « clé invalide », et la console du backend donne la raison exacte.
- **Leçon** : un indicateur doit dire exactement ce qu'il mesure. « Présente » n'est pas « valide ».

### BUG-22 — Whisper exécuté pendant la requête HTTP
- **Bloc** : 20
- **Symptôme** : envoyer l'audio d'une longue réunion laissait le navigateur en attente pendant toute la transcription, plusieurs minutes, jusqu'à l'abandon de la requête (délai dépassé) alors que le serveur travaillait encore.
- **Cause** : `uploadAndTranscribeHandler` attendait (`await`) la fin de Whisper avant de répondre. Une transcription sur processeur prend à peu près la durée de l'enregistrement.
- **Correction** : l'envoi répond `202 Accepted` tout de suite. Whisper, la mémoire puis l'analyse tournent en arrière-plan (`meeting-processing.service.js`). L'état est enregistré en base (`meetings.transcription_status`, migration 012) et la page l'interroge toutes les 3 s. Au démarrage, le serveur remet en erreur les traitements restés « en cours » (interrompus par l'arrêt précédent).
- **Test** : `tests/integration/enregistrement.it.mjs` (vrai Whisper) vérifie une réponse 202 en moins de 5 s, puis le passage à `done` ; `tests/unit/upload.controller.test.js` vérifie que le contrôleur n'attend pas le traitement.
- **Leçon** : une requête HTTP doit répondre en quelques secondes. Un travail long se lance en arrière-plan, avec un état consultable.

### BUG-23 — Limite de taille ignorée avec une valeur décimale
- **Bloc** : 20
- **Symptôme** : avec `MAX_AUDIO_MB=0.0001`, un fichier de 5 000 octets était accepté.
- **Cause** : `0.0001 × 1 048 576 = 104,857…`, qui n'est pas un nombre entier d'octets. `busboy` (utilisé par `multer`) ignore alors **complètement** la limite, sans erreur.
- **Correction** : `maxAudioBytes()` arrondit à l'entier inférieur (`Math.floor`).
- **Test** : `tests/unit/upload.middleware.test.js`, « fichier trop gros → 413 ».
- **Leçon** : une option invalide peut être ignorée en silence par une bibliothèque. Il faut tester l'effet réel d'une limite, pas seulement sa valeur.

### BUG-24 — Whisper « transcrit » un silence en phrase inventée
- **Bloc** : 20
- **Symptôme** : un enregistrement sans parole (micro coupé, bruit de la pièce) était transcrit « Thank you. », et l'analyse IA démarrait sur ce texte.
- **Cause** : comportement connu de Whisper. Sur du silence, le modèle produit des phrases fréquentes dans ses données d'entraînement (sous-titres de vidéos) : « Merci. », « Sous-titres réalisés par la communauté d'Amara.org », « Thank you. »…
- **Correction** : `isLikelySilenceHallucination` (`whisper.service.js`) compare la transcription **entière** à une liste de ces phrases. Si elle s'y réduit, le texte est considéré vide et l'utilisateur voit « Aucune parole détectée… vérifiez le micro ». Une vraie réunion qui contient « merci » n'est jamais rejetée.
- **Test** : `tests/unit/whisper.service.test.js` ; vérifié dans le navigateur en enregistrant 3 s de silence.
- **Leçon** : un modèle d'IA produit toujours une réponse, même sans données réelles. Il faut prévoir le cas « rien d'utile » explicitement.

### BUG-25 — Un envoi échoué remplaçait quand même l'audio
- **Bloc** : 20
- **Symptôme** : après l'échec d'un nouvel envoi (silence, panne de Whisper), la page montrait le nouvel enregistrement avec l'ancienne transcription : les deux ne correspondaient plus.
- **Cause** : le contrôleur enregistrait le nouvel audio (et supprimait l'ancien) **avant** la transcription.
- **Correction** : le service d'arrière-plan n'adopte le nouvel audio qu'**après** une transcription réussie ; en cas d'échec, le nouveau fichier est supprimé et l'ancien reste en place.
- **Test** : `tests/unit/meeting-processing.service.test.js` (« échec : le nouveau fichier est supprimé… ») et `upload.controller.test.js`.
- **Leçon** : une opération en plusieurs étapes ne doit modifier l'état visible qu'à la fin, quand tout a réussi.

### BUG-26 — Erreurs d'envoi transformées en erreur 500
- **Bloc** : 20
- **Symptôme** : un fichier d'un mauvais type, ou trop gros, donnait `500 Erreur interne du serveur`.
- **Cause** : les erreurs de `multer` (filtre de type, `LIMIT_FILE_SIZE`) n'avaient pas de code HTTP et arrivaient au gestionnaire d'erreurs générique.
- **Correction** : `uploadAudio` enveloppe `multer` et traduit ses erreurs : 413 (trop gros, avec la limite), 415 (type refusé, avec la liste des formats), 400 (autre erreur d'envoi). Le frontend vérifie aussi le fichier **avant** l'envoi.
- **Test** : `tests/unit/upload.middleware.test.js` et `tests/integration/enregistrement.it.mjs` (415).
- **Leçon** : une erreur prévisible de l'utilisateur mérite un code 4xx et un message qui dit quoi faire.

### BUG-27 — Transcription collée refusée au-delà de 100 Ko
- **Bloc** : 20
- **Symptôme** : coller la transcription d'une longue réunion répondait `413 request entity too large`, en anglais.
- **Cause** : `express.json()` limite par défaut le corps d'une requête à 100 Ko. Une heure de réunion fait environ 60 000 caractères, et les lettres accentuées comptent pour deux octets en UTF-8.
- **Correction** : `express.json({ limit: '1mb' })` dans `app.js` ; le contrôleur borne lui-même le texte à 200 000 caractères avec un message en français.
- **Test** : envoyer une transcription de 150 000 caractères à `POST /api/transcriptions/text` : réponse 201.
- **Leçon** : les limites par défaut d'une bibliothèque doivent être vérifiées par rapport aux usages réels de l'application.

### BUG-28 — Le suivi en direct s'arrêtait avant la fin de l'analyse
- **Bloc** : 21
- **Symptôme** : après avoir collé une transcription (ou à la fin d'une transcription audio), la page affichait parfois « Non analysée », sans bandeau, alors que l'analyse tournait. Il fallait recharger la page à la main pour voir le résultat.
- **Cause** : condition de course. L'analyse était lancée sans `await`, et elle n'écrivait `analysis_status = 'processing'` qu'au début de son exécution, une fraction de seconde plus tard. Une interrogation arrivée entre-temps lisait `none` (ou « transcription terminée, analyse non commencée ») et concluait que plus rien n'était en cours.
- **Correction** : l'état « en cours » est écrit **avant** de répondre (`startAutoAnalysis`, `analyzeMeetingHandler`). Après une transcription, l'analyse est marquée « en cours » **avant** que la transcription passe à « terminée » (`meeting-processing.service.js`). Il n'existe donc aucun instant où rien n'est « en cours » alors qu'il reste du travail.
- **Test** : `tests/unit/meeting-processing.service.test.js` vérifie l'**ordre** des deux écritures (`invocationCallOrder`) ; `tests/integration/resultats.it.mjs` interroge l'état immédiatement après l'envoi.
- **Leçon** : quand une tâche part en arrière-plan, son état doit être enregistré **avant** de rendre la main, pas par la tâche elle-même.

### BUG-29 — « Nouveau projet » : NULL au lieu de false
- **Bloc** : 21
- **Symptôme** : dans le détail d'une réunion, un projet existant avait `is_new: null` au lieu de `false`.
- **Cause** : logique à trois valeurs de SQL. Pour un projet sans réunion source, `source_meeting_id` vaut `NULL`, et `NULL = $1` ne vaut ni vrai ni faux : il vaut `NULL`.
- **Correction** : `COALESCE(p.source_meeting_id = $1, false) AS is_new` dans `meeting-detail.model.js`.
- **Test** : `tests/integration/resultats.it.mjs` vérifie `is_new === false` pour le projet existant et `true` pour le nouveau.
- **Leçon** : toute comparaison avec une colonne qui peut être `NULL` peut produire `NULL`. Il faut la protéger avec `COALESCE` ou `IS [NOT] DISTINCT FROM`.

### BUG-30 — Colonne « Statut » coupée dans « Mes tâches »
- **Bloc** : 21
- **Symptôme** : dans une fenêtre d'environ 930 px de large, la dernière colonne du tableau (le menu de statut) était coupée.
- **Cause** : le tableau imposait une largeur minimale de 760 px, alors que la zone de contenu (à côté du menu latéral) n'en faisait qu'environ 665.
- **Correction** : colonnes en `minmax(…)` et largeur minimale de 650 px ; en dessous, le tableau défile horizontalement au lieu d'être coupé.
- **Test** : vérifié dans le navigateur à 929 px de large : toutes les colonnes sont visibles.
- **Leçon** : vérifier une page à la largeur d'un portable ordinaire, pas seulement sur un grand écran.

### BUG-31 — Focus clavier perdu en changeant de mois dans le calendrier
- **Bloc** : 16
- **Symptôme** : dans le calendrier, la touche Page suivante affichait bien le mois suivant, mais plus aucune case n'avait le focus (`document.activeElement` = la page). L'utilisateur au clavier devait recommencer avec Tab.
- **Cause** : le jour actif (état React) et le mois (paramètre d'URL) changent dans **deux rendus successifs**. Au premier rendu, le jour visé n'est pas encore dans la grille : la page retombait sur « aujourd'hui », lui donnait le focus, puis cette case disparaissait au second rendu.
- **Correction** : `CalendarPage.jsx` garde la demande de focus tant que la case **visée** (`activeKey`) n'existe pas, et ne la donne qu'à elle.
- **Test** : dans le navigateur, depuis le jour courant : Page suivante (même jour, mois suivant), Flèche bas (semaine suivante), puis Page précédente deux fois : le focus suit la bonne case à chaque étape, y compris d'un mois à l'autre.
- **Leçon** : un état réparti entre React et l'URL ne se met pas à jour d'un seul coup. Une action qui dépend des deux doit attendre que les deux soient à jour.

### BUG-32 — Majuscule au nom du mois dans le calendrier
- **Bloc** : 16
- **Symptôme** : les titres du calendrier mettaient une majuscule au jour **et** au mois (« Mardi … Novembre … »).
- **Cause** : la propriété CSS `text-transform: capitalize` met une majuscule à **chaque mot**. C'est l'usage anglais, pas le français.
- **Correction** : la majuscule est ajoutée à la première lettre seulement, dans `monthLabel` et `dayLabel` (`utils/calendar.js`) ; la règle CSS est retirée.
- **Test** : `calendar.test.js` vérifie que seule la première lettre du titre du mois et du titre du jour est en majuscule.
- **Leçon** : les outils de mise en forme suivent souvent les règles typographiques anglaises. En français, la majuscule ne va qu'au début de la phrase et aux noms propres.

### BUG-33 — Une vérification a écrit dans la base de développement
- **Bloc** : 16
- **Symptôme** : un serveur de vérification lancé sur la base `veridian_verif` répondait 500 sur `/api/calendar`, et le compte de démonstration créé se retrouvait dans la base **`veridian`** (développement).
- **Cause** : les serveurs de développement (`start.ps1`) occupaient déjà les ports 3000 et 5173. Le second backend n'a pas pu écouter le port, et les requêtes arrivaient au premier, branché sur `veridian`. Comme cette base n'avait pas reçu les migrations récentes, la colonne `scheduled_at` y manquait, d'où l'erreur 500. Le port du backend était en plus codé en dur dans `vite.config.js`.
- **Correction** : les lignes ajoutées par erreur ont été retirées par leurs identifiants, dans une transaction. `vite.config.js` lit maintenant `BACKEND_URL`, et une seconde instance se lance sur d'autres ports (backend `PORT=3001 DB_NAME=veridian_verif`, Vite `--port 5174 --strictPort` avec `BACKEND_URL=http://localhost:3001`).
- **Test** : la vérification du calendrier a été refaite sur les ports 3001/5174 ; `/api/health` répond par le proxy de Vite.
- **Leçon** : avant de lancer un serveur de test, vérifier que le port est libre, et utiliser `--strictPort` pour qu'un port occupé soit une erreur visible. Après un changement de branche, relancer `start.ps1` pour appliquer les migrations : le code d'une branche suppose que ses migrations sont appliquées.

### BUG-34 — Erreur 500 sur un identifiant mal formé (décisions, mémoire)
- **Bloc** : 17
- **Symptôme** : `GET /api/decisions/project/abc`, `GET /api/memory/chunks/abc` et `POST /api/memory/chat` avec `projectId: "abc"` répondaient `500 Erreur interne du serveur`.
- **Cause** : ces contrôleurs (blocs 06 à 08) passaient l'identifiant tel quel à PostgreSQL, qui le refuse (`invalid input syntax for type uuid`, code `22P02`). Les autres contrôleurs le validaient déjà avec `isUuid` depuis le bloc 13.
- **Correction** : `isUuid` dans `decision.controller.js` (3 routes) et `memory.controller.js` (3 routes). Filet de sécurité dans `error.middleware.js` : le code `22P02` donne 400.
- **Test** : `tests/api/acces.api.test.js` envoie un identifiant mal formé à dix routes et exige 400 ; `security.test.js` teste le filet de sécurité.
- **Leçon** : une règle appliquée à la main dans chaque contrôleur finit par être oubliée quelque part. Un test qui parcourt **toutes** les routes la fait respecter.

### BUG-35 — La connexion révélait qu'un compte désactivé existait
- **Bloc** : 17
- **Symptôme** : avec n'importe quel mot de passe, un courriel de compte désactivé recevait `403 Ce compte a été désactivé`, et un courriel inconnu `401`. On pouvait donc savoir quels courriels étaient inscrits.
- **Cause** : `login` testait `is_active` **avant** de vérifier le mot de passe.
- **Correction** : `auth.controller.js` vérifie d'abord le mot de passe (401 identique dans tous les cas d'échec), puis seulement l'état du compte. Pour un courriel inconnu, une comparaison bcrypt avec une empreinte factice égalise aussi la durée de la réponse.
- **Test** : `auth.api.test.js` : compte désactivé + mauvais mot de passe → 401 ; + bon mot de passe → 403 ; mauvais mot de passe et courriel inconnu → réponses identiques.
- **Leçon** : chaque réponse différente (code, message, durée) est une information. Avant authentification, toutes les erreurs doivent se ressembler.

### BUG-36 — Deux comptes pour le même courriel (casse différente)
- **Bloc** : 17
- **Symptôme** : on pouvait s'inscrire avec `Julie@exemple.ca` puis avec `julie@exemple.ca`. La connexion dépendait de la casse saisie.
- **Cause** : la contrainte `UNIQUE` de PostgreSQL et la recherche `WHERE email = $1` distinguent les majuscules.
- **Correction** : courriel enregistré en minuscules (`validateRegistration`), recherche en `LOWER(email) = LOWER($1)` (`user.model.js`), index unique `users_email_lower` (migration 015). La migration ne crée pas l'index si des doublons existent déjà, et le signale.
- **Test** : `auth.api.test.js` : inscription en majuscules → 409 ; connexion en majuscules → 200.
- **Leçon** : une adresse courriel se compare sans tenir compte de la casse. La règle doit être appliquée dans la base, pas seulement dans le code.

### BUG-37 — `npm test` échouait sur un clone neuf
- **Bloc** : 17
- **Symptôme** : sans le fichier `.env.test` (ignoré par Git, donc absent d'un clone), 5 tests de `jwt.utils.test.js` échouaient : `secretOrPrivateKey must have a value`.
- **Cause** : le script `npm test` chargeait `.env.test` avec `dotenv-cli`, et les tests unitaires dépendaient de son `JWT_SECRET`. Ce fichier pointait en plus vers la base de **développement** (`DB_NAME=veridian`).
- **Correction** : `tests/setup-env.js` donne des valeurs par défaut aux tests unitaires, et `dotenv-cli` est retiré. Les tests d'API forcent la base `veridian_test` (`tests/api/setup-env.js`), quel que soit le contenu de `.env` ou `.env.test`.
- **Test** : `npm test` passe sans `.env.test`.
- **Leçon** : un test ne doit dépendre que de ce qui est dans le dépôt. Sinon il passe sur la machine du développeur et échoue partout ailleurs.

### BUG-38 — Les tâches des données de test n'apparaissaient nulle part
- **Bloc** : 22
- **Symptôme** : connecté avec un compte de test, « Mes tâches » était vide, le tableau de bord affichait 0 tâche, et la section Analyse des réunions n'avait aucune tâche, alors que la base en contenait 13.
- **Cause** : le jeu de données datait d'avant le bloc 19. Ses tâches liaient la personne par le champ texte `assignee` et par `user_id` (le créateur), sans `assignee_id`, et gardaient la valeur par défaut `source = 'manual'`. Or « Mes tâches » et le tableau de bord filtrent sur `assignee_id`, et l'analyse d'une réunion n'affiche que `source = 'ai'`. Les réunions restaient aussi « Non analysées ».
- **Correction** : `seed.js` écrit les tâches comme `pipeline.model.js` (`assignee_id`, `source = 'ai'`, `user_id` = organisateur, échéance à 17 h UTC, `due_estimated`). Les réunions sont marquées `transcription_status` et `analysis_status = 'done'`, avec leurs risques et leurs courriels.
- **Test** : `tests/api/seed.api.test.js` insère les données dans `veridian_test` et vérifie, par les routes, « Mes tâches » de Marie, le détail d'une réunion, le tableau de bord et le calendrier.
- **Leçon** : un jeu de données doit évoluer avec le schéma. S'il n'est relu par aucun test, il se périme sans que personne ne le remarque.

### BUG-39 — Le projet des données de test cachait un « nouveau projet » des scénarios
- **Bloc** : 22
- **Symptôme** : après l'ajout des données de test, le scénario `pipeline.it.mjs` ne créait plus « Portail fournisseurs ». L'analyse le retrouvait comme projet **existant**, et l'ajoutait au mauvais propriétaire.
- **Cause** : la première version du nouveau jeu de données créait un projet portant ce même nom, que le scénario (et le test réel à la voix) utilise pour vérifier la **création** d'un projet par une réunion.
- **Correction** : le projet créé par la réunion des données de test s'appelle « Boutique en ligne ».
- **Test** : `pipeline.it.mjs` lancé sur une base peuplée par `seed.js` affiche à nouveau « Portail fournisseurs (nouveau) », avec Admin propriétaire et Samuel membre.
- **Leçon** : les données de test et les scénarios partagent la même base. Leurs noms ne doivent pas se recouvrir quand un test dépend de l'*absence* d'une donnée.
