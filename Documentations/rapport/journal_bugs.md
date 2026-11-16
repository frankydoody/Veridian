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
- **Leçon** : un `.gitattributes` fixe la règle **dans le dépôt**, pour toutes les machines, alors que `core.autocrlf` dépend de la configuration de chacun.

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
