import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 09 : contrôle d'accès et validation du chat (aucune base, aucun réseau).

const createConversation = jest.fn();
const findConversationsByProject = jest.fn();
const findConversationById = jest.fn();
const findMessagesByConversation = jest.fn();
const deactivateConversation = jest.fn();
const findProjectById = jest.fn();
const askInConversation = jest.fn();

jest.unstable_mockModule('../../src/models/chat.model.js', () => ({
  createConversation, findConversationsByProject, findConversationById,
  findMessagesByConversation, deactivateConversation,
}));
jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectById }));
jest.unstable_mockModule('../../src/services/chat.service.js', () => ({ askInConversation }));

const {
  createConversationHandler, getConversationsHandler, getConversationHandler,
  sendMessageHandler, deleteConversationHandler,
} = await import('../../src/controllers/chat.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const UUID = '3f2b8c1e-5a4d-4e8f-9b1a-2c3d4e5f6a7b';
const user = { id: 'u1' };

beforeEach(() => jest.clearAllMocks());

describe('createConversationHandler', () => {
  test('400 sans projectId valide', async () => {
    const res = makeRes();
    await createConversationHandler({ body: { projectId: 'abc' }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(createConversation).not.toHaveBeenCalled();
  });

  test('400 si le titre est trop long', async () => {
    const res = makeRes();
    await createConversationHandler({ body: { projectId: UUID, title: 'x'.repeat(201) }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 et aucune création si l\'utilisateur n\'est pas membre du projet', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await createConversationHandler({ body: { projectId: UUID }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(createConversation).not.toHaveBeenCalled();
  });

  test('201 pour un membre', async () => {
    findProjectById.mockResolvedValue({ id: UUID });
    createConversation.mockResolvedValue({ id: 'c1' });
    const res = makeRes();
    await createConversationHandler({ body: { projectId: UUID, title: ' Mon sujet ' }, user }, res, jest.fn());
    expect(createConversation).toHaveBeenCalledWith(UUID, 'u1', 'Mon sujet');
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('getConversationsHandler', () => {
  test('400 sans projectId', async () => {
    const res = makeRes();
    await getConversationsHandler({ query: {}, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 pour un non-membre, sans lire les conversations', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await getConversationsHandler({ query: { projectId: UUID }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findConversationsByProject).not.toHaveBeenCalled();
  });

  test('200 avec le décompte', async () => {
    findProjectById.mockResolvedValue({ id: UUID });
    findConversationsByProject.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    const res = makeRes();
    await getConversationsHandler({ query: { projectId: UUID }, user }, res, jest.fn());
    expect(findConversationsByProject).toHaveBeenCalledWith(UUID, 'u1');
    expect(res.json.mock.calls[0][0]).toMatchObject({ count: 2 });
  });
});

describe('getConversationHandler', () => {
  test('400 si l\'identifiant est invalide', async () => {
    const res = makeRes();
    await getConversationHandler({ params: { id: 'zzz' }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('404 si la conversation n\'est pas celle de l\'utilisateur, sans lire les messages', async () => {
    findConversationById.mockResolvedValue(undefined);
    const res = makeRes();
    await getConversationHandler({ params: { id: UUID }, user }, res, jest.fn());
    expect(findConversationById).toHaveBeenCalledWith(UUID, 'u1');
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findMessagesByConversation).not.toHaveBeenCalled();
  });

  test('200 avec les messages', async () => {
    findConversationById.mockResolvedValue({ id: UUID });
    findMessagesByConversation.mockResolvedValue([{ role: 'user' }, { role: 'assistant' }]);
    const res = makeRes();
    await getConversationHandler({ params: { id: UUID }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].messages).toHaveLength(2);
  });
});

describe('sendMessageHandler', () => {
  test.each([
    [{}],
    [{ question: '   ' }],
    [{ question: 42 }],
    [{ question: 'x'.repeat(2001) }],
  ])('400 pour une question invalide %j', async (body) => {
    const res = makeRes();
    await sendMessageHandler({ params: { id: UUID }, body, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(askInConversation).not.toHaveBeenCalled();
  });

  test('404 si la conversation appartient à quelqu\'un d\'autre : l\'IA n\'est pas appelée', async () => {
    findConversationById.mockResolvedValue(undefined);
    const res = makeRes();
    await sendMessageHandler({ params: { id: UUID }, body: { question: 'Salut ?' }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(askInConversation).not.toHaveBeenCalled();
  });

  test('201 avec la question nettoyée et la réponse', async () => {
    const conversation = { id: UUID, project_id: 'p1' };
    findConversationById.mockResolvedValue(conversation);
    askInConversation.mockResolvedValue({
      hasContext: true,
      userMessage: { role: 'user' },
      assistantMessage: { role: 'assistant' },
    });
    const res = makeRes();
    await sendMessageHandler({ params: { id: UUID }, body: { question: '  Quelle base ?  ' }, user }, res, jest.fn());
    expect(askInConversation).toHaveBeenCalledWith(conversation, 'Quelle base ?');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0]).toMatchObject({ hasContext: true });
  });

  test('502 si l\'IA est en panne (et pas d\'erreur 500 générique)', async () => {
    findConversationById.mockResolvedValue({ id: UUID });
    askInConversation.mockRejectedValue(new Error('quota'));
    const next = jest.fn();
    const res = makeRes();
    await sendMessageHandler({ params: { id: UUID }, body: { question: 'Salut ?' }, user }, res, next);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('deleteConversationHandler', () => {
  test('404 si la conversation n\'est pas à l\'utilisateur', async () => {
    deactivateConversation.mockResolvedValue(undefined);
    const res = makeRes();
    await deleteConversationHandler({ params: { id: UUID }, user }, res, jest.fn());
    expect(deactivateConversation).toHaveBeenCalledWith(UUID, 'u1');
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('200 quand la conversation est désactivée', async () => {
    deactivateConversation.mockResolvedValue({ id: UUID });
    const res = makeRes();
    await deleteConversationHandler({ params: { id: UUID }, user }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
