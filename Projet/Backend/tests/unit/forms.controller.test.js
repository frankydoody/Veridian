import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 13 — formulaires « Créer un projet » et « Créer une réunion ». Modèles simulés.
const createProjectWithOwner = jest.fn();
const findProjectById = jest.fn();
const createMeetingWithHost = jest.fn();
const findMeetingById = jest.fn();

jest.unstable_mockModule('../../src/models/project.model.js', () => ({
  createProjectWithOwner,
  findProjectById,
  findProjectsByUser: jest.fn(),
  updateProject: jest.fn(),
  updateProjectStatus: jest.fn(),
}));
jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({
  createMeetingWithHost,
  findMeetingById,
  findMeetingsByProject: jest.fn(),
  updateMeetingStatus: jest.fn(),
  findAllMeetings: jest.fn(),
}));

const { createProjectHandler, getProjectByIdHandler } = await import('../../src/controllers/project.controller.js');
const { createMeetingHandler, getMeetingByIdHandler } = await import('../../src/controllers/meeting.controller.js');

const USER = '22222222-2222-4222-8222-222222222222';
const PROJECT = '11111111-1111-4111-8111-111111111111';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const req = (body = {}, params = {}) => ({ body, params, user: { id: USER } });

describe('Créer un projet', () => {
  beforeEach(() => jest.clearAllMocks());

  test('nom vide → 400', async () => {
    const res = makeRes();
    await createProjectHandler(req({ name: '   ' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createProjectWithOwner).not.toHaveBeenCalled();
  });

  test('nom trop long (> 150) → 400', async () => {
    const res = makeRes();
    await createProjectHandler(req({ name: 'x'.repeat(151) }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('création → 201, nom nettoyé, créateur propriétaire', async () => {
    createProjectWithOwner.mockResolvedValue({ id: PROJECT, name: 'Atlas' });
    const res = makeRes();
    await createProjectHandler(req({ name: '  Atlas  ', description: '' }), res, jest.fn());
    expect(createProjectWithOwner).toHaveBeenCalledWith('Atlas', null, USER);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('lecture avec un identifiant invalide → 400 au lieu d\'une erreur 500', async () => {
    const res = makeRes();
    await getProjectByIdHandler(req({}, { id: 'pas-un-uuid' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findProjectById).not.toHaveBeenCalled();
  });
});

describe('Créer une réunion', () => {
  beforeEach(() => jest.clearAllMocks());

  test('titre manquant → 400', async () => {
    const res = makeRes();
    await createMeetingHandler(req({ projectId: PROJECT }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createMeetingWithHost).not.toHaveBeenCalled();
  });

  test('projet invalide → 400', async () => {
    const res = makeRes();
    await createMeetingHandler(req({ projectId: '12', title: 'Revue' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('projet dont l\'utilisateur n\'est pas membre → 404', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await createMeetingHandler(req({ projectId: PROJECT, title: 'Revue' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(createMeetingWithHost).not.toHaveBeenCalled();
  });

  test('création → 201, l\'organisateur est l\'utilisateur connecté', async () => {
    findProjectById.mockResolvedValue({ id: PROJECT });
    createMeetingWithHost.mockResolvedValue({ id: 'm-1', title: 'Revue de sprint' });
    const res = makeRes();
    await createMeetingHandler(req({ projectId: PROJECT, title: ' Revue de sprint ' }), res, jest.fn());
    expect(createMeetingWithHost).toHaveBeenCalledWith(PROJECT, 'Revue de sprint', null, USER, null);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  // Bloc 16 : date prévue, utilisée par le calendrier
  test('date prévue valide → transmise au modèle en Date', async () => {
    findProjectById.mockResolvedValue({ id: PROJECT });
    createMeetingWithHost.mockResolvedValue({ id: 'm-2' });
    const res = makeRes();
    await createMeetingHandler(req({ projectId: PROJECT, title: 'Planif', scheduledAt: '2026-12-05T19:30:00.000Z' }), res, jest.fn());
    const scheduled = createMeetingWithHost.mock.calls[0][4];
    expect(scheduled).toBeInstanceOf(Date);
    expect(scheduled.toISOString()).toBe('2026-12-05T19:30:00.000Z');
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('date prévue invalide → 400, rien n\'est créé', async () => {
    const res = makeRes();
    await createMeetingHandler(req({ projectId: PROJECT, title: 'Planif', scheduledAt: 'demain' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Date de réunion invalide' });
    expect(createMeetingWithHost).not.toHaveBeenCalled();
  });

  test('lecture avec un identifiant invalide → 400', async () => {
    const res = makeRes();
    await getMeetingByIdHandler(req({}, { id: 'x' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
