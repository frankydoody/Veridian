import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 13 — formulaire de tâche (création, modification, suppression). Modèles simulés.
const findAllTasks = jest.fn();
const findTaskForUser = jest.fn();
const createTask = jest.fn();
const updateTask = jest.fn();
const updateTaskStatus = jest.fn();
const deactivateTask = jest.fn();
const findProjectById = jest.fn();
const findMeetingById = jest.fn();
const isActiveMember = jest.fn();

jest.unstable_mockModule('../../src/models/task.model.js', () => ({
  findAllTasks, findTaskForUser, createTask, updateTask, updateTaskStatus, deactivateTask,
}));
jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectById }));
jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({ findMeetingById }));
jest.unstable_mockModule('../../src/models/member.model.js', () => ({ isActiveMember }));

const {
  createTaskHandler, updateTaskHandler, updateTaskStatusHandler, deleteTaskHandler, validateTaskFields,
} = await import('../../src/controllers/task.controller.js');

const USER = '22222222-2222-4222-8222-222222222222';
const OTHER = '33333333-3333-4333-8333-333333333333';
const PROJECT = '11111111-1111-4111-8111-111111111111';
const TASK = '44444444-4444-4444-8444-444444444444';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
};
const req = (body = {}, params = {}) => ({ body, params, user: { id: USER } });

describe('validateTaskFields', () => {
  test('titre obligatoire à la création, facultatif en modification', () => {
    expect(validateTaskFields({}).error).toMatch(/titre est obligatoire/);
    expect(validateTaskFields({}, { partial: true })).toEqual({ fields: {} });
  });
  test('priorité, statut, date et acteur vérifiés', () => {
    expect(validateTaskFields({ title: 'T', priority: 'urgente' }).error).toMatch(/Priorité/);
    expect(validateTaskFields({ title: 'T', status: 'fini' }).error).toMatch(/Statut/);
    expect(validateTaskFields({ title: 'T', due_date: 'demain' }).error).toMatch(/Date/);
    expect(validateTaskFields({ title: 'T', assignee_id: 'Marie' }).error).toMatch(/acteur/);
    expect(validateTaskFields({ title: 'T', assignee_id: '' }).fields.assignee_id).toBeNull();
  });
});

describe('createTaskHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('acteur non membre du projet → 400, rien n\'est créé', async () => {
    findProjectById.mockResolvedValue({ id: PROJECT });
    isActiveMember.mockResolvedValue(false);
    const res = makeRes();
    await createTaskHandler(req({ title: 'Maquettes', project_id: PROJECT, assignee_id: OTHER }), res, jest.fn());
    expect(isActiveMember).toHaveBeenCalledWith(PROJECT, OTHER);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createTask).not.toHaveBeenCalled();
  });

  test('acteur sans projet → 400', async () => {
    const res = makeRes();
    await createTaskHandler(req({ title: 'Maquettes', assignee_id: OTHER }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createTask).not.toHaveBeenCalled();
  });

  test('projet dont l\'utilisateur n\'est pas membre → 404', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await createTaskHandler(req({ title: 'Maquettes', project_id: PROJECT }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(createTask).not.toHaveBeenCalled();
  });

  test('création complète → 201 avec la date à 17 h UTC', async () => {
    findProjectById.mockResolvedValue({ id: PROJECT });
    isActiveMember.mockResolvedValue(true);
    createTask.mockResolvedValue({ id: TASK });
    findTaskForUser.mockResolvedValue({ id: TASK, title: 'Maquettes' });
    const res = makeRes();
    await createTaskHandler(req({
      title: ' Maquettes ', priority: 'haute', project_id: PROJECT, assignee_id: OTHER, due_date: '2026-12-01',
    }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(201);
    const saved = createTask.mock.calls[0][0];
    expect(saved.title).toBe('Maquettes');
    expect(saved.user_id).toBe(USER);
    expect(saved.due_date.toISOString()).toBe('2026-12-01T17:00:00.000Z');
  });
});

describe('updateTaskHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tâche invisible pour l\'utilisateur → 404 et aucune modification', async () => {
    findTaskForUser.mockResolvedValue(undefined);
    const res = makeRes();
    await updateTaskHandler(req({ title: 'X' }, { id: TASK }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(updateTask).not.toHaveBeenCalled();
  });

  test('identifiant invalide → 400', async () => {
    const res = makeRes();
    await updateTaskHandler(req({ title: 'X' }, { id: 'abc' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findTaskForUser).not.toHaveBeenCalled();
  });

  test('nouvel acteur hors du projet → 400', async () => {
    findTaskForUser.mockResolvedValue({ id: TASK, project_id: PROJECT });
    isActiveMember.mockResolvedValue(false);
    const res = makeRes();
    await updateTaskHandler(req({ assignee_id: OTHER }, { id: TASK }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(updateTask).not.toHaveBeenCalled();
  });

  test('retirer l\'acteur (null) est permis sans vérification de membre', async () => {
    findTaskForUser.mockResolvedValue({ id: TASK, project_id: PROJECT });
    updateTask.mockResolvedValue({ id: TASK });
    const res = makeRes();
    await updateTaskHandler(req({ assignee_id: null }, { id: TASK }), res, jest.fn());
    expect(isActiveMember).not.toHaveBeenCalled();
    expect(updateTask).toHaveBeenCalledWith(TASK, { assignee_id: null });
  });

  test('aucun champ → 400', async () => {
    findTaskForUser.mockResolvedValue({ id: TASK, project_id: PROJECT });
    const res = makeRes();
    await updateTaskHandler(req({}, { id: TASK }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('updateTaskStatusHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('renvoie la tâche complète (avec le nom du projet), pas la ligne brute', async () => {
    updateTaskStatus.mockResolvedValue({ id: TASK });
    findTaskForUser.mockResolvedValue({ id: TASK, status: 'done', project_name: 'Atlas' });
    const res = makeRes();
    await updateTaskStatusHandler(req({ status: 'done' }, { id: TASK }), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ task: { id: TASK, status: 'done', project_name: 'Atlas' } });
  });
});

describe('deleteTaskHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('tâche invisible → 404 (et non 204 comme avant)', async () => {
    findTaskForUser.mockResolvedValue(undefined);
    const res = makeRes();
    await deleteTaskHandler(req({}, { id: TASK }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(deactivateTask).not.toHaveBeenCalled();
  });

  test('membre qui n\'est ni créateur ni propriétaire → 403', async () => {
    findTaskForUser.mockResolvedValue({ id: TASK });
    deactivateTask.mockResolvedValue(false);
    const res = makeRes();
    await deleteTaskHandler(req({}, { id: TASK }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('suppression logique réussie → 204', async () => {
    findTaskForUser.mockResolvedValue({ id: TASK });
    deactivateTask.mockResolvedValue(true);
    const res = makeRes();
    await deleteTaskHandler(req({}, { id: TASK }), res, jest.fn());
    expect(deactivateTask).toHaveBeenCalledWith(TASK, USER);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});
