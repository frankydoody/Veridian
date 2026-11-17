import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 16 — GET /api/calendar : validation de la plage, contrôle d'appartenance AVANT lecture.
const findCalendarMeetings = jest.fn();
const findCalendarTasks = jest.fn();
const findProjectById = jest.fn();
jest.unstable_mockModule('../../src/models/calendar.model.js', () => ({ findCalendarMeetings, findCalendarTasks }));
jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectById }));
const { getCalendarHandler } = await import('../../src/controllers/calendar.controller.js');

const USER = '11111111-1111-4111-8111-111111111111';
const PROJECT = '22222222-2222-4222-8222-222222222222';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const req = (query) => ({ user: { id: USER }, query });

describe('getCalendarHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findCalendarMeetings.mockResolvedValue([{ id: 'm-1' }]);
    findCalendarTasks.mockResolvedValue([{ id: 't-1' }]);
  });

  test('plage valide, tous les projets → réunions et tâches de l\'utilisateur', async () => {
    const res = makeRes();
    await getCalendarHandler(req({ from: '2026-11-30', to: '2027-01-10' }), res, jest.fn());
    const filters = { userId: USER, from: '2026-11-30', to: '2027-01-10', projectId: null };
    expect(findCalendarMeetings).toHaveBeenCalledWith(filters);
    expect(findCalendarTasks).toHaveBeenCalledWith(filters);
    expect(findProjectById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      from: '2026-11-30', to: '2027-01-10', projectId: null,
      meetings: [{ id: 'm-1' }], tasks: [{ id: 't-1' }],
    });
  });

  test('plage absente ou invalide → 400, aucune lecture', async () => {
    const res = makeRes();
    await getCalendarHandler(req({ from: '2026-12-01' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findCalendarMeetings).not.toHaveBeenCalled();
  });

  test('projectId mal formé → 400', async () => {
    const res = makeRes();
    await getCalendarHandler(req({ from: '2026-12-01', to: '2026-12-31', projectId: 'abc' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findProjectById).not.toHaveBeenCalled();
  });

  test('projet dont l\'utilisateur n\'est pas membre → 404, aucune lecture', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await getCalendarHandler(req({ from: '2026-12-01', to: '2026-12-31', projectId: PROJECT }), res, jest.fn());
    expect(findProjectById).toHaveBeenCalledWith(PROJECT, USER);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findCalendarMeetings).not.toHaveBeenCalled();
    expect(findCalendarTasks).not.toHaveBeenCalled();
  });

  test('projet dont l\'utilisateur est membre → lecture filtrée sur ce projet', async () => {
    findProjectById.mockResolvedValue({ id: PROJECT });
    const res = makeRes();
    await getCalendarHandler(req({ from: '2026-12-01', to: '2026-12-31', projectId: PROJECT }), res, jest.fn());
    expect(findCalendarMeetings).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('erreur de base → transmise au gestionnaire d\'erreurs', async () => {
    findCalendarTasks.mockRejectedValue(new Error('base indisponible'));
    const next = jest.fn();
    await getCalendarHandler(req({ from: '2026-12-01', to: '2026-12-31' }), makeRes(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'base indisponible' }));
  });
});
