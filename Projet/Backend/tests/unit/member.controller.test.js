import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 13 — membres d'un projet. Modèles simulés : aucune base de données.
const findProjectById = jest.fn();
const findProjectMembers = jest.fn();
const findActiveUserByEmail = jest.fn();
const addProjectMember = jest.fn();
const deactivateProjectMember = jest.fn();

jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectById }));
jest.unstable_mockModule('../../src/models/member.model.js', () => ({
  findProjectMembers, findActiveUserByEmail, addProjectMember, deactivateProjectMember,
}));

const { getMembersHandler, addMemberHandler, removeMemberHandler } =
  await import('../../src/controllers/member.controller.js');

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const MEMBER_ID = '33333333-3333-4333-8333-333333333333';

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const makeReq = ({ userId = OWNER_ID, params = {}, body = {} } = {}) => ({
  params: { id: PROJECT_ID, ...params }, body, user: { id: userId },
});
const ownedProject = { id: PROJECT_ID, owner_id: OWNER_ID, name: 'Projet' };

describe('member.controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('GET : un non-membre reçoit 404 et la liste n\'est jamais lue', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await getMembersHandler(makeReq({ userId: MEMBER_ID }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findProjectMembers).not.toHaveBeenCalled();
  });

  test('GET : identifiant de projet invalide → 400 (pas d\'appel à la base)', async () => {
    const res = makeRes();
    await getMembersHandler(makeReq({ params: { id: 'abc' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findProjectById).not.toHaveBeenCalled();
  });

  test('GET : un membre obtient la liste', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    findProjectMembers.mockResolvedValue([{ id: OWNER_ID, name: 'Admin', email: 'a@x.com', role: 'owner' }]);
    const res = makeRes();
    await getMembersHandler(makeReq({ userId: MEMBER_ID }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].count).toBe(1);
  });

  test('POST : un membre qui n\'est pas propriétaire reçoit 403 et rien n\'est ajouté', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    const res = makeRes();
    await addMemberHandler(makeReq({ userId: MEMBER_ID, body: { email: 'x@example.com' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
    expect(addProjectMember).not.toHaveBeenCalled();
  });

  test('POST : courriel invalide → 400', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    const res = makeRes();
    await addMemberHandler(makeReq({ body: { email: 'pas-un-courriel' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('POST : compte inexistant → 404 avec un message explicatif', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    findActiveUserByEmail.mockResolvedValue(undefined);
    const res = makeRes();
    await addMemberHandler(makeReq({ body: { email: 'inconnu@example.com' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].message).toMatch(/créer son compte/);
  });

  test('POST : ajout réussi (courriel normalisé) → 201, sans password_hash', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    findActiveUserByEmail.mockResolvedValue({ id: MEMBER_ID, name: 'Marie', email: 'marie@example.com' });
    addProjectMember.mockResolvedValue({ role: 'member', joined_at: new Date() });
    const res = makeRes();
    await addMemberHandler(makeReq({ body: { email: '  Marie@Example.com ' } }), res, jest.fn());
    expect(findActiveUserByEmail).toHaveBeenCalledWith('marie@example.com');
    expect(addProjectMember).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/password/);
  });

  test('POST : déjà membre → 409', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    findActiveUserByEmail.mockResolvedValue({ id: MEMBER_ID, name: 'Marie', email: 'marie@example.com' });
    addProjectMember.mockResolvedValue(undefined);
    const res = makeRes();
    await addMemberHandler(makeReq({ body: { email: 'marie@example.com' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('DELETE : le propriétaire ne peut jamais être retiré', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    const res = makeRes();
    await removeMemberHandler(makeReq({ params: { userId: OWNER_ID } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(deactivateProjectMember).not.toHaveBeenCalled();
  });

  test('DELETE : retrait d\'un membre par le propriétaire → 200', async () => {
    findProjectById.mockResolvedValue(ownedProject);
    deactivateProjectMember.mockResolvedValue(true);
    const res = makeRes();
    await removeMemberHandler(makeReq({ params: { userId: MEMBER_ID } }), res, jest.fn());
    expect(deactivateProjectMember).toHaveBeenCalledWith(PROJECT_ID, MEMBER_ID);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('DELETE : un non-membre du projet reçoit 404', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await removeMemberHandler(makeReq({ userId: MEMBER_ID, params: { userId: OWNER_ID } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(deactivateProjectMember).not.toHaveBeenCalled();
  });
});
