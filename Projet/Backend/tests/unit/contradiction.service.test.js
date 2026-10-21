import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 08 : service de détection des contradictions.
// L'IA et les modèles sont remplacés par des doublures : aucun appel réseau, aucune base.

const detectContradiction = jest.fn();
const findDecisionsForComparison = jest.fn();
const createAlertAndMarkConflict = jest.fn();

jest.unstable_mockModule('../../src/services/ia.service.js', () => ({ detectContradiction }));
jest.unstable_mockModule('../../src/models/decision.model.js', () => ({ findDecisionsForComparison }));
jest.unstable_mockModule('../../src/models/alert.model.js', () => ({ createAlertAndMarkConflict }));

const { checkContradictions, checkContradictionsSafely } =
  await import('../../src/services/contradiction.service.js');

const past = [
  { id: 'old-1', content: 'Héberger le site chez Cloudflare Pages' },
  { id: 'old-2', content: 'Utiliser React avec Vite' },
];
const newDecision = { id: 'new-1', content: 'Migrer vers un serveur interne' };

describe('checkContradictions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findDecisionsForComparison.mockResolvedValue(past);
    createAlertAndMarkConflict.mockImplementation(async (a) => ({ id: 'alert-1', ...a }));
  });

  test('ne fait aucun appel à l\'IA quand le projet n\'a pas de décision passée', async () => {
    findDecisionsForComparison.mockResolvedValue([]);

    const alerts = await checkContradictions('m-2', 'p-1', [newDecision]);

    expect(alerts).toEqual([]);
    expect(detectContradiction).not.toHaveBeenCalled();
  });

  test('crée une alerte entre la nouvelle décision et l\'ancienne en conflit', async () => {
    detectContradiction.mockResolvedValue({
      conflictDecision: past[0], severity: 'high', explanation: 'Hébergements incompatibles',
    });

    const alerts = await checkContradictions('m-2', 'p-1', [newDecision]);

    expect(findDecisionsForComparison).toHaveBeenCalledWith('p-1', 'm-2');
    expect(createAlertAndMarkConflict).toHaveBeenCalledWith({
      newDecisionId: 'new-1',
      conflictDecisionId: 'old-1',
      projectId: 'p-1',
      explanation: 'Hébergements incompatibles',
      severity: 'high',
    });
    expect(alerts).toHaveLength(1);
  });

  test('ne crée rien quand l\'IA ne trouve pas de contradiction', async () => {
    detectContradiction.mockResolvedValue(null);

    const alerts = await checkContradictions('m-2', 'p-1', [newDecision]);

    expect(alerts).toEqual([]);
    expect(createAlertAndMarkConflict).not.toHaveBeenCalled();
  });

  test('ignore un résultat dont l\'index de conflit est hors limites', async () => {
    detectContradiction.mockResolvedValue({ conflictDecision: undefined, severity: 'high', explanation: 'x' });

    const alerts = await checkContradictions('m-2', 'p-1', [newDecision]);

    expect(alerts).toEqual([]);
    expect(createAlertAndMarkConflict).not.toHaveBeenCalled();
  });

  test('remplace une sévérité invalide par « medium » et une explication vide par un texte par défaut', async () => {
    detectContradiction.mockResolvedValue({ conflictDecision: past[1], severity: 'critique', explanation: null });

    await checkContradictions('m-2', 'p-1', [newDecision]);

    const args = createAlertAndMarkConflict.mock.calls[0][0];
    expect(args.severity).toBe('medium');
    expect(args.explanation).toBeTruthy();
  });

  test('une analyse qui échoue n\'empêche pas d\'analyser les décisions suivantes', async () => {
    const second = { id: 'new-2', content: 'Autre décision' };
    detectContradiction
      .mockRejectedValueOnce(new Error('429 quota'))
      .mockResolvedValueOnce({ conflictDecision: past[1], severity: 'low', explanation: 'ok' });

    const alerts = await checkContradictions('m-2', 'p-1', [newDecision, second]);

    expect(alerts).toHaveLength(1);
    expect(createAlertAndMarkConflict.mock.calls[0][0].newDecisionId).toBe('new-2');
  });

  test('une décision déjà contredite n\'est plus proposée à l\'IA pour les décisions suivantes', async () => {
    const second = { id: 'new-2', content: 'Autre décision' };
    detectContradiction
      .mockResolvedValueOnce({ conflictDecision: past[0], severity: 'high', explanation: 'a' })
      .mockResolvedValueOnce(null);

    await checkContradictions('m-2', 'p-1', [newDecision, second]);

    const candidatesSecondCall = detectContradiction.mock.calls[1][1];
    expect(candidatesSecondCall.map((d) => d.id)).toEqual(['old-2']);
  });
});

describe('checkContradictionsSafely', () => {
  beforeEach(() => jest.clearAllMocks());

  test('ne lance jamais d\'erreur : renvoie checked=false si la base échoue', async () => {
    findDecisionsForComparison.mockRejectedValue(new Error('base indisponible'));

    const result = await checkContradictionsSafely('m-2', 'p-1', [newDecision]);

    expect(result).toEqual({ checked: false, count: 0, alerts: [] });
  });

  test('renvoie le nombre d\'alertes créées', async () => {
    findDecisionsForComparison.mockResolvedValue(past);
    detectContradiction.mockResolvedValue({ conflictDecision: past[0], severity: 'high', explanation: 'x' });
    createAlertAndMarkConflict.mockResolvedValue({ id: 'alert-1' });

    const result = await checkContradictionsSafely('m-2', 'p-1', [newDecision]);

    expect(result.checked).toBe(true);
    expect(result.count).toBe(1);
  });
});
