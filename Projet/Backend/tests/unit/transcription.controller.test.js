import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Test de régression de sécurité : PUT /api/transcriptions/:id ne doit JAMAIS
// modifier une transcription dont l'utilisateur n'est pas membre du projet.
// Les modèles et services sont remplacés par des « doublures » (mocks) : le
// test ne touche ni la base de données ni l'API d'IA.

const findTranscriptionById = jest.fn();
const updateTranscriptionText = jest.fn();
const findMeetingById = jest.fn();
const indexTranscriptionSafely = jest.fn();

jest.unstable_mockModule('../../src/models/transcription.model.js', () => ({
  createTranscription: jest.fn(),
  findTranscriptionByMeeting: jest.fn(),
  findTranscriptionById,
  updateTranscriptionText,
}));
jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({ findMeetingById }));
jest.unstable_mockModule('../../src/services/whisper.service.js', () => ({ transcribeAudio: jest.fn() }));
jest.unstable_mockModule('../../src/services/memory.service.js', () => ({ indexTranscriptionSafely }));

const { updateTranscriptionHandler } = await import('../../src/controllers/transcription.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeReq = () => ({
  params: { id: 't-1' },
  body: { rawText: 'nouveau texte' },
  user: { id: 'user-b' },
});

describe('updateTranscriptionHandler (contrôle d\'accès)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('doit répondre 404 et NE PAS modifier si l\'utilisateur n\'est pas membre du projet', async () => {
    findTranscriptionById.mockResolvedValue({ id: 't-1', meeting_id: 'm-1' });
    findMeetingById.mockResolvedValue(undefined);   // pas membre

    const res = makeRes();
    await updateTranscriptionHandler(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(updateTranscriptionText).not.toHaveBeenCalled();
    expect(indexTranscriptionSafely).not.toHaveBeenCalled();
  });

  test('doit répondre 404 si la transcription n\'existe pas', async () => {
    findTranscriptionById.mockResolvedValue(undefined);

    const res = makeRes();
    await updateTranscriptionHandler(makeReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(updateTranscriptionText).not.toHaveBeenCalled();
  });

  test('doit modifier et ré-indexer si l\'utilisateur est membre du projet', async () => {
    findTranscriptionById.mockResolvedValue({ id: 't-1', meeting_id: 'm-1' });
    findMeetingById.mockResolvedValue({ id: 'm-1', project_id: 'p-1' });
    updateTranscriptionText.mockResolvedValue({ id: 't-1', meeting_id: 'm-1', raw_text: 'nouveau texte' });
    indexTranscriptionSafely.mockResolvedValue({ indexed: true, stored: 1 });

    const res = makeRes();
    await updateTranscriptionHandler(makeReq(), res, jest.fn());

    expect(updateTranscriptionText).toHaveBeenCalledWith('t-1', 'nouveau texte');
    expect(indexTranscriptionSafely).toHaveBeenCalledWith('m-1', 'p-1', 'nouveau texte');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
