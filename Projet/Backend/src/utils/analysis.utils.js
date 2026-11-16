// src/utils/analysis.utils.js
// Bloc 19 — Fonctions pures qui nettoient et complètent la réponse de l'IA
// (noms d'acteurs, projets, dates). Aucune base de données, aucun réseau : testables.

const PRIORITIES = ['haute', 'moyenne', 'basse'];
const SEVERITIES = ['low', 'medium', 'high'];
const RISK_KINDS = ['risque', 'incoherence', 'echeance', 'dependance'];

// Délai de repli (en jours) quand l'IA ne propose pas de date exploitable
export const DEFAULT_DAYS_BY_PRIORITY = { haute: 3, moyenne: 7, basse: 14 };

// « Éric  » → « eric » : minuscules, sans accents, sans espaces superflus
export const normalizeName = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Retrouve un élément d'une liste à partir d'un nom écrit par l'IA.
 * Ordre : égalité exacte, puis prénom seul (option firstToken, pour les personnes),
 * puis « contient ».
 * Un résultat ambigu (plusieurs candidats) retourne null : on préfère
 * « non assigné » à une mauvaise personne.
 */
export const matchByName = (name, list, getName = (x) => x.name, { firstToken = false } = {}) => {
  const target = normalizeName(name);
  if (!target || !Array.isArray(list)) return null;

  const names = list.map((item) => normalizeName(getName(item)));

  const exact = list.filter((_, i) => names[i] === target);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  // Prénom seul : seulement pour les personnes (« Marie » → « Marie Tremblay »)
  if (firstToken) {
    const byFirst = list.filter((_, i) => names[i].split(' ')[0] === target.split(' ')[0]);
    if (byFirst.length === 1) return byFirst[0];
  }

  const partial = list.filter((_, i) => names[i].includes(target) || target.includes(names[i]));
  return partial.length === 1 ? partial[0] : null;
};

export const normalizePriority = (value) => {
  const p = normalizeName(value);
  if (['haute', 'high', 'urgente', 'urgent', 'elevee'].includes(p)) return 'haute';
  if (['basse', 'low', 'faible'].includes(p)) return 'basse';
  return PRIORITIES.includes(p) ? p : 'moyenne';
};

export const normalizeSeverity = (value) => {
  const s = normalizeName(value);
  if (['high', 'haute', 'elevee', 'critique'].includes(s)) return 'high';
  if (['low', 'basse', 'faible'].includes(s)) return 'low';
  return SEVERITIES.includes(s) ? s : 'medium';
};

const addDays = (from, days) => {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(17, 0, 0, 0);
  return d;
};

/**
 * Date de fin d'une tâche. Si l'IA a donné une date valide et à venir, on la garde.
 * Sinon on l'estime d'après la priorité. `estimated` indique que la date est approximative.
 */
export const resolveDueDate = (priority, aiDate, now = new Date()) => {
  if (aiDate) {
    // « AAAA-MM-JJ » seul = midi (17 h UTC) : évite qu'un fuseau décale la date d'un jour
    const raw = String(aiDate).trim();
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T17:00:00Z`) : new Date(raw);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime()) {
      return { dueDate: parsed, estimated: false };
    }
  }
  return { dueDate: addDays(now, DEFAULT_DAYS_BY_PRIORITY[priority] ?? 7), estimated: true };
};

const text = (v, max = 2000) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

/**
 * Transforme la réponse brute de l'IA en objets prêts à être enregistrés.
 *
 * @param raw     objet renvoyé par analyzeMeeting
 * @param ctx     { projects: projets de l'utilisateur, users: personnes connues,
 *                  defaultProject: projet de la réunion, now }
 */
export const normalizeAnalysis = (raw, ctx) => {
  const { projects = [], users = [], defaultProject, now = new Date() } = ctx;
  const data = raw && typeof raw === 'object' ? raw : {};

  // ── Projets : le projet de la réunion est toujours présent ──────────────────
  const refs = [{ key: defaultProject.id, existing: defaultProject, name: defaultProject.name, description: null }];

  for (const p of Array.isArray(data.projects) ? data.projects : []) {
    const name = text(p?.name, 150);
    if (!name) continue;
    const existing = matchByName(name, projects);
    const key = existing ? existing.id : `new:${normalizeName(name)}`;
    if (refs.some((r) => r.key === key)) {
      // Projet déjà vu : on garde la première description non vide
      const ref = refs.find((r) => r.key === key);
      ref.description = ref.description || text(p.description);
      continue;
    }
    refs.push({ key, existing: existing || null, name: existing ? existing.name : name, description: text(p.description) });
  }

  const refFor = (projectName) => {
    const existing = matchByName(projectName, refs, (r) => r.name);
    return existing || refs[0];
  };

  // ── Décisions ───────────────────────────────────────────────────────────────
  const decisions = (Array.isArray(data.decisions) ? data.decisions : [])
    .map((d) => {
      const content = text(d?.content);
      if (!content) return null;
      const confidence = Number(d.confidence);
      return {
        projectKey: refFor(d.project).key,
        content,
        context: text(d.context),
        responsible: text(d.responsible, 150),
        alternatives: Array.isArray(d.alternatives) ? d.alternatives.map((a) => text(a)).filter(Boolean) : [],
        confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 80,
      };
    })
    .filter(Boolean);

  // ── Tâches : acteur lié à un utilisateur, date estimée ──────────────────────
  const tasks = (Array.isArray(data.tasks) ? data.tasks : [])
    .map((t) => {
      const title = text(t?.title, 200);
      if (!title) return null;
      const priority = normalizePriority(t.priority);
      const { dueDate, estimated } = resolveDueDate(priority, t.dueDate, now);
      const user = matchByName(t.assignee, users, (u) => u.name, { firstToken: true });
      return {
        projectKey: refFor(t.project).key,
        title,
        description: text(t.description),
        priority,
        assigneeName: text(t.assignee, 150),
        assigneeId: user ? user.id : null,
        assigneeEmail: user ? user.email : null,
        dueDate,
        dueEstimated: estimated,
      };
    })
    .filter(Boolean);

  return { projects: refs, decisions, tasks };
};

/** Nettoie les risques renvoyés par assessProjectRisks. */
export const normalizeRisks = (raw) =>
  (Array.isArray(raw) ? raw : [])
    .map((r) => {
      const description = text(r?.description);
      if (!description) return null;
      const kind = normalizeName(r.kind);
      return {
        kind: RISK_KINDS.includes(kind) ? kind : 'risque',
        description,
        severity: normalizeSeverity(r.severity),
        mitigation: text(r.mitigation),
      };
    })
    .filter(Boolean);
