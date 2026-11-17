import { describe, test, expect, jest } from '@jest/globals';

// Bloc 21 — GET /api/dashboard : les compteurs viennent du modèle, pour l'utilisateur connecté.
const findDashboardSummary = jest.fn();
jest.unstable_mockModule('../../src/models/dashboard.model.js', () => ({ findDashboardSummary }));
const { getDashboardHandler } = await import('../../src/controllers/dashboard.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('getDashboardHandler', () => {
  test('renvoie les compteurs de l\'utilisateur connecté (et seulement les siens)', async () => {
    findDashboardSummary.mockResolvedValue({ my_overdue_tasks: 1, open_alerts: 2, upcoming_tasks: [] });
    const res = makeRes();
    await getDashboardHandler({ user: { id: 'u-1' } }, res, jest.fn());
    expect(findDashboardSummary).toHaveBeenCalledWith('u-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ my_overdue_tasks: 1, open_alerts: 2, upcoming_tasks: [] });
  });

  test('erreur de base : transmise au gestionnaire d\'erreurs', async () => {
    findDashboardSummary.mockRejectedValue(new Error('base indisponible'));
    const next = jest.fn();
    await getDashboardHandler({ user: { id: 'u-1' } }, makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'base indisponible' }));
  });
});
