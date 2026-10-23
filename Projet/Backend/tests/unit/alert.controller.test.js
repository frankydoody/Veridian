import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 08 : contrôle d'accès des routes d'alertes (aucune base, aucun réseau).

const findAlertsByProject = jest.fn();
const resolveAlert = jest.fn();
const findProjectById = jest.fn();

jest.unstable_mockModule('../../src/models/alert.model.js', () => ({ findAlertsByProject, resolveAlert }));
jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectById }));

const { getAlertsByProjectHandler, resolveAlertHandler } =
  await import('../../src/controllers/alert.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const UUID = '3f2b8c1e-5a4d-4e8f-9b1a-2c3d4e5f6a7b';

describe('getAlertsByProjectHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 si l\'identifiant du projet n\'est pas un UUID', async () => {
    const res = makeRes();
    await getAlertsByProjectHandler({ params: { projectId: 'abc' }, query: {}, user: { id: 'u1' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(findProjectById).not.toHaveBeenCalled();
  });

  test('404 et AUCUNE lecture des alertes si l\'utilisateur n\'est pas membre du projet', async () => {
    findProjectById.mockResolvedValue(undefined);

    const res = makeRes();
    await getAlertsByProjectHandler({ params: { projectId: UUID }, query: {}, user: { id: 'u-intrus' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(findAlertsByProject).not.toHaveBeenCalled();
  });

  test('200 avec le décompte des alertes ouvertes pour un membre', async () => {
    findProjectById.mockResolvedValue({ id: UUID });
    findAlertsByProject.mockResolvedValue([
      { id: 'a1', resolved_at: null },
      { id: 'a2', resolved_at: '2026-01-01T00:00:00Z' },
    ]);

    const res = makeRes();
    await getAlertsByProjectHandler({ params: { projectId: UUID }, query: {}, user: { id: 'u1' } }, res, jest.fn());

    expect(findAlertsByProject).toHaveBeenCalledWith(UUID, { onlyOpen: false });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ count: 2, openCount: 1 });
  });

  test('?status=open ne demande que les alertes non résolues', async () => {
    findProjectById.mockResolvedValue({ id: UUID });
    findAlertsByProject.mockResolvedValue([]);

    await getAlertsByProjectHandler({ params: { projectId: UUID }, query: { status: 'open' }, user: { id: 'u1' } }, makeRes(), jest.fn());

    expect(findAlertsByProject).toHaveBeenCalledWith(UUID, { onlyOpen: true });
  });
});

describe('resolveAlertHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('400 si l\'identifiant de l\'alerte n\'est pas un UUID', async () => {
    const res = makeRes();
    await resolveAlertHandler({ params: { id: 'xyz' }, user: { id: 'u1' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(resolveAlert).not.toHaveBeenCalled();
  });

  test('404 si l\'alerte n\'existe pas OU si l\'utilisateur n\'est pas membre (même réponse)', async () => {
    resolveAlert.mockResolvedValue(undefined);

    const res = makeRes();
    await resolveAlertHandler({ params: { id: UUID }, user: { id: 'u-intrus' } }, res, jest.fn());

    expect(resolveAlert).toHaveBeenCalledWith(UUID, 'u-intrus');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 avec l\'alerte résolue pour un membre', async () => {
    resolveAlert.mockResolvedValue({ id: UUID, resolved_at: '2026-01-01T00:00:00Z' });

    const res = makeRes();
    await resolveAlertHandler({ params: { id: UUID }, user: { id: 'u1' } }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].alert.resolved_at).toBeTruthy();
  });
});
