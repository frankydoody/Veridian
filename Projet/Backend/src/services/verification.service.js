// src/services/verification.service.js
// Bloc 18 : vérification complète d'une installation (npm run verifier, start.ps1 -Verifier,
// ./start.sh --verifier). Chaque contrôle renvoie un statut et un message actionnable en
// français ; aucun secret n'est jamais affiché.
//
// Les dépendances (base, Gemini, commandes, SMTP, réseau) sont INJECTÉES : les tests
// remplacent chacune d'elles sans toucher au réseau.

export const STATUS = { OK: 'ok', WARN: 'warn', ERROR: 'error', SKIP: 'skip' };

const ok = (detail) => ({ status: STATUS.OK, detail });
const warn = (detail) => ({ status: STATUS.WARN, detail });
const error = (detail) => ({ status: STATUS.ERROR, detail });
const skip = (detail) => ({ status: STATUS.SKIP, detail });

/** true si le SMTP configuré est la boîte de test locale Mailpit (docker-compose.yml). */
export const isLocalMailbox = (env) =>
  ['127.0.0.1', 'localhost'].includes(env.SMTP_HOST) && String(env.SMTP_PORT) === '1025';

/** Migrations présentes dans le dossier mais absentes de schema_migrations, dans l'ordre. */
export const missingMigrations = (files, applied) => {
  const done = new Set(applied);
  return files.filter((f) => f.endsWith('.sql') && !done.has(f)).sort();
};

/**
 * Construit la liste des contrôles.
 * @param deps {
 *   env, securityProblems(): string[],
 *   query(sql): Promise<{rows}>, migrationFiles(): string[],
 *   generate(prompt): Promise<string>, embed(text): Promise<number[]>, embedDimensions,
 *   commandWorks(cmd, args): Promise<boolean>,
 *   smtpVerify(): Promise<void>,
 *   portBusy(port): Promise<boolean>, fetchText(url): Promise<string|null>,
 * }
 * @param options { skipAi, skipWhisper }
 */
export const buildChecks = (deps, { skipAi = false, skipWhisper = false } = {}) => {
  const { env } = deps;
  let dbReachable = false;

  return [
    {
      name: 'Fichier .env',
      run: async () => {
        const problems = deps.securityProblems();
        return problems.length ? error(problems.join(' ')) : ok('présent, secret JWT solide');
      },
    },
    {
      name: 'Base de données',
      run: async () => {
        try {
          await deps.query('SELECT 1');
          dbReachable = true;
          return ok(`${env.DB_USER}@${env.DB_HOST}:${env.DB_PORT}/${env.DB_NAME}`);
        } catch (e) {
          return error(`injoignable (${e.code || e.message}). Démarrez Docker Desktop puis « docker compose up -d » `
            + 'à la racine du dépôt, ou relancez le script de démarrage.');
        }
      },
    },
    {
      name: 'Extension vector (pgvector)',
      run: async () => {
        if (!dbReachable) return skip('base injoignable');
        const { rows } = await deps.query("SELECT extversion FROM pg_extension WHERE extname = 'vector'");
        return rows.length
          ? ok(`version ${rows[0].extversion}`)
          : error('absente. Relancez le script de démarrage (il applique schema.sql), '
            + 'ou vérifiez que docker-compose.yml utilise l\'image pgvector/pgvector.');
      },
    },
    {
      name: 'Migrations',
      run: async () => {
        if (!dbReachable) return skip('base injoignable');
        const files = deps.migrationFiles();
        let applied = [];
        try {
          ({ rows: applied } = await deps.query('SELECT name FROM schema_migrations'));
        } catch {
          return error('table schema_migrations absente : relancez le script de démarrage.');
        }
        const missing = missingMigrations(files, applied.map((r) => r.name));
        return missing.length
          ? error(`${missing.length} non appliquée(s) : ${missing.join(', ')}. Relancez le script de démarrage.`)
          : ok(`${files.length} appliquées (dernière : ${files.at(-1) ?? 'aucune'})`);
      },
    },
    {
      name: 'Clé Gemini (analyse)',
      run: async () => {
        if (skipAi) return skip('option --sans-ia');
        if (!env.GEMINI_API_KEY) return error('GEMINI_API_KEY vide dans Projet/Backend/.env (clé gratuite : https://aistudio.google.com/apikey).');
        try {
          await deps.generate('Réponds uniquement par le mot OK.');
          return ok(`clé acceptée, modèle ${env.AI_MODEL || 'par défaut'} disponible`);
        } catch (e) {
          return error(e.message);
        }
      },
    },
    {
      name: 'Gemini (mémoire, embeddings)',
      run: async () => {
        if (skipAi) return skip('option --sans-ia');
        if (!env.GEMINI_API_KEY) return skip('clé absente');
        try {
          const vector = await deps.embed('test');
          return vector.length === deps.embedDimensions
            ? ok(`${vector.length} dimensions`)
            : error(`${vector.length} dimensions reçues, ${deps.embedDimensions} attendues (EMBED_MODEL).`);
        } catch (e) {
          return error(e.message);
        }
      },
    },
    {
      name: 'ffmpeg',
      run: async () => {
        if (skipWhisper) return skip('option --sans-whisper');
        const cmd = env.FFMPEG_COMMAND || 'ffmpeg';
        return (await deps.commandWorks(cmd, ['-version']))
          ? ok(cmd)
          : error('introuvable. Windows : winget install Gyan.FFmpeg ; Linux : sudo apt install ffmpeg. '
            + 'Ouvrez ensuite un NOUVEAU terminal (ou indiquez le chemin dans FFMPEG_COMMAND).');
      },
    },
    {
      name: 'Whisper (transcription)',
      run: async () => {
        if (skipWhisper) return skip('option --sans-whisper');
        const cmd = env.WHISPER_COMMAND || 'whisper';
        return (await deps.commandWorks(cmd, ['--help']))
          ? ok(`${cmd}, modèle ${env.WHISPER_MODEL || 'small'}`)
          : error('introuvable. Relancez le script de démarrage (il l\'installe), ouvrez un NOUVEAU terminal, '
            + 'ou indiquez son chemin complet dans WHISPER_COMMAND.');
      },
    },
    {
      name: 'Courriels (SMTP)',
      run: async () => {
        if (!env.SMTP_HOST) {
          return warn('SMTP non configuré : courriels simulés (affichés dans la console du backend). '
            + 'Relancez le script de démarrage pour utiliser la boîte de test locale (Mailpit), '
            + 'ou renseignez SMTP_HOST, SMTP_USER et SMTP_PASSWORD pour de vrais envois.');
        }
        const local = isLocalMailbox(env);
        try {
          await deps.smtpVerify(); // connexion et authentification, sans envoyer de courriel
          return ok(local
            ? `boîte de test locale Mailpit (${env.SMTP_HOST}:1025) : les courriels restent sur ce PC`
            : `${env.SMTP_HOST}:${env.SMTP_PORT || 587} joignable, identifiants acceptés`);
        } catch (e) {
          if (local) {
            return error('Mailpit ne répond pas sur le port 1025 : démarrez Docker Desktop puis « docker compose up -d » '
              + 'à la racine du dépôt (ou relancez le script de démarrage).');
          }
          const auth = e.code === 'EAUTH' || /auth|credentials|535/i.test(e.message);
          return error(auth
            ? 'identifiants refusés : utilisez un mot de passe d\'application (Gmail : https://myaccount.google.com/apppasswords) dans SMTP_PASSWORD.'
            : `${env.SMTP_HOST}:${env.SMTP_PORT || 587} injoignable (${e.code || e.message}) : vérifiez SMTP_HOST, SMTP_PORT et SMTP_SECURE.`);
        }
      },
    },
    {
      name: 'Boîte courriel de test',
      run: async () => {
        if (!env.MAILBOX_URL) return skip('non utilisée (MAILBOX_URL vide)');
        const base = env.MAILBOX_URL.replace(/\/+$/, '');
        const info = await deps.fetchText(`${base}/api/v1/info`);
        return info?.includes('"Version"')
          ? ok(`${base} (lien « Boîte courriel de test » dans l'application)`)
          : error(`${base} ne répond pas : démarrez Docker Desktop puis « docker compose up -d » (conteneur veridian_mail).`);
      },
    },
    ...[
      { port: Number(env.PORT) || 3000, label: 'backend', url: `http://localhost:${Number(env.PORT) || 3000}/api/health`, mark: '"status":"ok"' },
      { port: 5173, label: 'frontend', url: 'http://localhost:5173/', mark: '<title>Veridian</title>' },
    ].map(({ port, label, url, mark }) => ({
      name: `Port ${port} (${label})`,
      run: async () => {
        if (!(await deps.portBusy(port))) return ok('libre');
        const body = await deps.fetchText(url);
        return body?.includes(mark)
          ? ok(`déjà utilisé par Veridian (${label} démarré)`)
          : error(`occupé par un autre programme : fermez-le avant de démarrer Veridian.`);
      },
    })),
  ];
};

/** Exécute les contrôles dans l'ordre ; une exception inattendue devient une erreur. */
export const runChecks = async (checks) => {
  const results = [];
  for (const check of checks) {
    let result;
    try {
      result = await check.run();
    } catch (e) {
      result = error(e.message);
    }
    results.push({ name: check.name, ...result });
  }
  return results;
};

const LABEL = { ok: '[OK]       ', warn: '[ATTENTION]', error: '[ERREUR]   ', skip: '[IGNORÉ]   ' };

/** Rapport lisible + bilan. */
export const formatReport = (results) => {
  const lines = results.map((r) => `${LABEL[r.status]} ${r.name} : ${r.detail}`);
  const errors = results.filter((r) => r.status === STATUS.ERROR).length;
  const warnings = results.filter((r) => r.status === STATUS.WARN).length;
  lines.push('');
  lines.push(errors
    ? `${errors} problème(s) à corriger${warnings ? `, ${warnings} avertissement(s)` : ''}.`
    : `Tout est prêt${warnings ? ` (${warnings} avertissement(s))` : ''}.`);
  return lines.join('\n');
};

export const hasErrors = (results) => results.some((r) => r.status === STATUS.ERROR);

/**
 * Messages affichés au démarrage du backend : ce qui fonctionne en mode dégradé est dit
 * clairement (courriels simulés, IA indisponible) au lieu d'être découvert plus tard.
 */
export const startupNotices = (env = process.env) => {
  const notices = [];
  if (!env.SMTP_HOST) {
    notices.push('⚠️ SMTP non configuré : courriels simulés (affichés dans cette console, aucun envoi réel).');
  } else if (isLocalMailbox(env)) {
    notices.push(`📬 Courriels : boîte de test locale Mailpit${env.MAILBOX_URL ? ` (${env.MAILBOX_URL})` : ''}, aucun courriel ne sort de ce PC.`);
  } else {
    notices.push(`📧 Courriels : envoi réel par ${env.SMTP_HOST}:${env.SMTP_PORT || 587}`);
  }
  if (!env.GEMINI_API_KEY) {
    notices.push('⚠️ GEMINI_API_KEY vide : analyse des réunions et mémoire IA indisponibles (voir Projet/Backend/.env).');
  }
  return notices;
};
