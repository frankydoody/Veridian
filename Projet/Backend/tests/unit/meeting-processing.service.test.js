import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 20 — traitement en arrière-plan : Whisper → transcription → mémoire → analyse.
const transcribeAudio = jest.fn();
const indexTranscriptionSafely = jest.fn();
const processMeetingSafely = jest.fn();
const setTranscriptionStatus = jest.fn();
const createTranscription = jest.fn();
const findTranscriptionByMeeting = jest.fn();
const updateTranscriptionText = jest.fn();

jest.unstable_mockModule('../../src/services/whisper.service.js', () => ({ transcribeAudio }));
jest.unstable_mockModule('../../src/services/memory.service.js', () => ({ indexTranscriptionSafely }));
jest.unstable_mockModule('../../src/services/meeting-pipeline.service.js', () => ({ processMeetingSafely }));
jest.unstable_mockModule('../../src/models/processing.model.js', () => ({ setTranscriptionStatus }));
jest.unstable_mockModule('../../src/models/transcription.model.js', () => ({
  createTranscription, findTranscriptionByMeeting, updateTranscriptionText,
}));

const { transcribeMeetingAudio, transcribeMeetingAudioSafely } =
  await import('../../src/services/meeting-processing.service.js');

const meeting = { id: 'm-1', project_id: 'p-1' };
const user = { id: 'u-1', email: 'a@x.com' };

describe('transcribeMeetingAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findTranscriptionByMeeting.mockResolvedValue(undefined);
    createTranscription.mockResolvedValue({ id: 't-1' });
    indexTranscriptionSafely.mockResolvedValue({ indexed: true, stored: 2 });
  });

  test('succès : en cours → terminé, transcription créée, mémoire puis analyse', async () => {
    transcribeAudio.mockResolvedValue('Marie fera les maquettes.');
    await transcribeMeetingAudio(meeting, user, '/tmp/a.webm');

    expect(setTranscriptionStatus.mock.calls.map((c) => c[1])).toEqual(['processing', 'done']);
    expect(createTranscription).toHaveBeenCalledWith('m-1', 'Marie fera les maquettes.');
    expect(indexTranscriptionSafely).toHaveBeenCalledWith('m-1', 'p-1', 'Marie fera les maquettes.');
    expect(processMeetingSafely).toHaveBeenCalledWith(meeting, user);
  });

  test('transcription existante : elle est remplacée (pas de doublon)', async () => {
    transcribeAudio.mockResolvedValue('Nouveau texte');
    findTranscriptionByMeeting.mockResolvedValue({ id: 't-old' });
    await transcribeMeetingAudio(meeting, user, '/tmp/a.webm');
    expect(updateTranscriptionText).toHaveBeenCalledWith('t-old', 'Nouveau texte');
    expect(createTranscription).not.toHaveBeenCalled();
  });

  test('aucune parole détectée : erreur claire, rien n\'est enregistré ni analysé', async () => {
    transcribeAudio.mockResolvedValue('');
    await expect(transcribeMeetingAudio(meeting, user, '/tmp/a.webm')).rejects.toThrow(/Aucune parole/);
    expect(setTranscriptionStatus).toHaveBeenLastCalledWith('m-1', 'error', expect.stringMatching(/Aucune parole/));
    expect(createTranscription).not.toHaveBeenCalled();
    expect(processMeetingSafely).not.toHaveBeenCalled();
  });

  test('échec de Whisper : le message est enregistré pour l\'utilisateur', async () => {
    transcribeAudio.mockRejectedValue(new Error('ffmpeg est introuvable'));
    await expect(transcribeMeetingAudio(meeting, user, '/tmp/a.webm')).rejects.toThrow('ffmpeg');
    expect(setTranscriptionStatus).toHaveBeenLastCalledWith('m-1', 'error', 'ffmpeg est introuvable');
  });

  test('autoAnalyze: false → transcription seulement', async () => {
    transcribeAudio.mockResolvedValue('Texte');
    await transcribeMeetingAudio(meeting, user, '/tmp/a.webm', { autoAnalyze: false });
    expect(processMeetingSafely).not.toHaveBeenCalled();
  });

  test('version Safely : ne lance jamais d\'erreur (appelée sans await)', async () => {
    transcribeAudio.mockRejectedValue(new Error('panne'));
    await expect(transcribeMeetingAudioSafely(meeting, user, '/tmp/a.webm')).resolves.toBeNull();
  });
});
