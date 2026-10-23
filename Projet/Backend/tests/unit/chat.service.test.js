import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 09 : logique du chat avec historique (modèle, recherche et IA simulés).

const retrieveChunks = jest.fn();
const chatWithMemory = jest.fn();
const findRecentMessages = jest.fn();
const addExchange = jest.fn();

jest.unstable_mockModule('../../src/services/memory.service.js', () => ({ retrieveChunks }));
jest.unstable_mockModule('../../src/services/ia.service.js', () => ({ chatWithMemory }));
jest.unstable_mockModule('../../src/models/chat.model.js', () => ({ findRecentMessages, addExchange }));

const { askInConversation, buildSearchQuery } = await import('../../src/services/chat.service.js');

const conversation = { id: 'c1', project_id: 'p1' };
const chunk = { meeting_id: 'm1', meeting_title: 'Revue', chunk_type: 'decision', chunk_text: 'Utiliser React', similarity: 0.8123 };

beforeEach(() => {
  jest.clearAllMocks();
  findRecentMessages.mockResolvedValue([]);
  addExchange.mockImplementation(async (id, { question, answer }) => ({
    userMessage: { role: 'user', content: question },
    assistantMessage: { role: 'assistant', content: answer },
  }));
});

describe('buildSearchQuery', () => {
  test('sans historique : la question seule', () => {
    expect(buildSearchQuery('Quelle base ?', [])).toBe('Quelle base ?');
  });

  test('avec historique : ajoute la dernière question de l\'utilisateur', () => {
    const history = [
      { role: 'user', content: 'Quel framework ?' },
      { role: 'assistant', content: 'React.' },
    ];
    expect(buildSearchQuery('Et qui s\'en occupe ?', history)).toBe('Quel framework ?\nEt qui s\'en occupe ?');
  });
});

describe('askInConversation', () => {
  test('cherche dans le bon projet, répond avec les sources et enregistre l\'échange', async () => {
    retrieveChunks.mockResolvedValue([chunk]);
    chatWithMemory.mockResolvedValue('On utilise React (Source 1).');

    const result = await askInConversation(conversation, 'Quel framework ?');

    expect(retrieveChunks).toHaveBeenCalledWith('Quel framework ?', { projectId: 'p1' });
    expect(addExchange).toHaveBeenCalledWith('c1', {
      question: 'Quel framework ?',
      answer: 'On utilise React (Source 1).',
      sources: [{ meetingId: 'm1', meetingTitle: 'Revue', chunkType: 'decision', similarity: 0.81 }],
    });
    expect(result.hasContext).toBe(true);
  });

  test('transmet l\'historique au LLM', async () => {
    const history = [{ role: 'user', content: 'Quel framework ?' }, { role: 'assistant', content: 'React.' }];
    findRecentMessages.mockResolvedValue(history);
    retrieveChunks.mockResolvedValue([chunk]);
    chatWithMemory.mockResolvedValue('Marie.');

    await askInConversation(conversation, 'Et qui s\'en occupe ?');

    expect(chatWithMemory).toHaveBeenCalledWith('Et qui s\'en occupe ?', [chunk], history);
    expect(retrieveChunks.mock.calls[0][0]).toContain('Quel framework ?');
  });

  test('sans extrait pertinent : réponse fixe, le LLM n\'est pas appelé, l\'échange est gardé', async () => {
    retrieveChunks.mockResolvedValue([]);

    const result = await askInConversation(conversation, 'Question hors sujet');

    expect(chatWithMemory).not.toHaveBeenCalled();
    expect(result.hasContext).toBe(false);
    expect(addExchange.mock.calls[0][1]).toMatchObject({ sources: [] });
    expect(addExchange.mock.calls[0][1].answer).toMatch(/aucune information/i);
  });

  test('si l\'IA échoue, rien n\'est enregistré et l\'erreur remonte', async () => {
    retrieveChunks.mockResolvedValue([chunk]);
    chatWithMemory.mockRejectedValue(new Error('503'));

    await expect(askInConversation(conversation, 'Q ?')).rejects.toThrow('503');
    expect(addExchange).not.toHaveBeenCalled();
  });
});
