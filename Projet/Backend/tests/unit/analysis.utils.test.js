import { describe, test, expect } from '@jest/globals';
import {
  normalizeName, matchByName, normalizePriority, resolveDueDate, normalizeAnalysis, normalizeRisks,
} from '../../src/utils/analysis.utils.js';

const NOW = new Date('2026-11-02T14:00:00Z');
const projects = [
  { id: 'p-1', name: 'Refonte du site web client' },
  { id: 'p-2', name: 'Application mobile Atlas' },
];
const users = [
  { id: 'u-1', name: 'Marie Tremblay', email: 'marie@x.ca' },
  { id: 'u-2', name: 'Éric Gagnon', email: 'eric@x.ca' },
  { id: 'u-3', name: 'Marc Gagnon', email: 'marc@x.ca' },
];
const ctx = { projects, users, defaultProject: projects[0], now: NOW };

describe('normalizeName / matchByName', () => {
  test('ignore les accents, la casse et les espaces', () => {
    expect(normalizeName('  Éric   GAGNON ')).toBe('eric gagnon');
  });

  test('retrouve une personne par prénom seul quand il est unique', () => {
    expect(matchByName('marie', users, (u) => u.name, { firstToken: true }).id).toBe('u-1');
    expect(matchByName('Eric', users, (u) => u.name, { firstToken: true }).id).toBe('u-2');
  });

  test('retourne null si le nom est ambigu ou inconnu (jamais la mauvaise personne)', () => {
    expect(matchByName('Gagnon', users, (u) => u.name, { firstToken: true })).toBeNull();
    expect(matchByName('Zoé', users, (u) => u.name, { firstToken: true })).toBeNull();
    expect(matchByName('', users)).toBeNull();
  });

  test('un projet ne se confond pas avec un autre qui commence par le même mot', () => {
    expect(matchByName('Refonte de la paie', projects)).toBeNull();
    expect(matchByName('Refonte du site web', projects).id).toBe('p-1');
  });
});

describe('priorités et dates', () => {
  test('normalise les priorités', () => {
    expect(normalizePriority('Urgent')).toBe('haute');
    expect(normalizePriority('low')).toBe('basse');
    expect(normalizePriority('n\'importe quoi')).toBe('moyenne');
  });

  test('garde une date future donnée par l\'IA', () => {
    const r = resolveDueDate('haute', '2026-11-20', NOW);
    expect(r.estimated).toBe(false);
    expect(r.dueDate.toISOString().slice(0, 10)).toBe('2026-11-20');
    // la date seule est fixée à 17 h UTC : aucun fuseau ne peut la décaler d'un jour
    expect(r.dueDate.toISOString()).toBe('2026-11-20T17:00:00.000Z');
  });

  test('estime la date selon la priorité si elle est absente, invalide ou passée', () => {
    expect(resolveDueDate('haute', null, NOW).dueDate.toISOString().slice(0, 10)).toBe('2026-11-05');
    expect(resolveDueDate('moyenne', 'pas une date', NOW).dueDate.toISOString().slice(0, 10)).toBe('2026-11-09');
    const past = resolveDueDate('basse', '2020-01-01', NOW);
    expect(past.estimated).toBe(true);
    expect(past.dueDate.toISOString().slice(0, 10)).toBe('2026-11-16');
  });
});

describe('normalizeAnalysis', () => {
  const raw = {
    projects: [
      { name: 'refonte du site web client', description: 'x' },
      { name: 'Portail fournisseurs', description: 'Nouveau portail pour les fournisseurs' },
    ],
    decisions: [
      { project: 'Portail fournisseurs', content: 'Utiliser React', confidence: 150 },
      { project: 'inconnu', content: 'Garder PostgreSQL' },
      { content: '' },
    ],
    tasks: [
      { project: 'Portail fournisseurs', title: 'Maquettes', assignee: 'marie', priority: 'haute', dueDate: '2026-11-10' },
      { title: 'Migrer la base', assignee: 'Gagnon' },
      { project: 'Application mobile Atlas', title: 'Écrire les tests', assignee: 'Éric Gagnon', dueDate: null },
    ],
  };
  const out = normalizeAnalysis(raw, ctx);

  test('réutilise le projet existant et détecte le nouveau', () => {
    expect(out.projects.map((p) => [p.name, !!p.existing])).toEqual([
      ['Refonte du site web client', true],
      ['Portail fournisseurs', false],
    ]);
  });

  test('les éléments sans projet reconnu retombent sur le projet de la réunion', () => {
    expect(out.decisions[1].projectKey).toBe('p-1');
    expect(out.tasks[1].projectKey).toBe('p-1');
  });

  test('un projet existant mentionné mais absent de la liste de l\'IA est rattaché quand même', () => {
    // « Application mobile Atlas » n'est pas dans raw.projects : la tâche retombe sur le projet par défaut
    expect(out.tasks[2].projectKey).toBe('p-1');
  });

  test('lie les acteurs aux utilisateurs et laisse null les ambigus', () => {
    expect(out.tasks[0].assigneeId).toBe('u-1');
    expect(out.tasks[1].assigneeId).toBeNull();
    expect(out.tasks[1].assigneeName).toBe('Gagnon');
  });

  test('borne la confiance, retire les éléments vides, estime les dates manquantes', () => {
    expect(out.decisions).toHaveLength(2);
    expect(out.decisions[0].confidence).toBe(100);
    expect(out.tasks[0].dueEstimated).toBe(false);
    expect(out.tasks[1].dueEstimated).toBe(true);
  });

  test('survit à une réponse vide ou invalide', () => {
    expect(normalizeAnalysis(null, ctx)).toMatchObject({ decisions: [], tasks: [] });
    expect(normalizeAnalysis({ tasks: 'oops' }, ctx).tasks).toEqual([]);
  });
});

describe('normalizeRisks', () => {
  test('nettoie type, gravité et textes', () => {
    const r = normalizeRisks([
      { kind: 'Echeance', description: 'Marie a 5 tâches cette semaine', severity: 'élevée', mitigation: 'Répartir' },
      { kind: 'bizarre', description: 'Autre', severity: 'zzz' },
      { description: '' },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ kind: 'echeance', severity: 'high' });
    expect(r[1]).toMatchObject({ kind: 'risque', severity: 'medium' });
  });
});
