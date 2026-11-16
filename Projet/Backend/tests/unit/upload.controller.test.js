import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Bloc 20 — POST /api/transcriptions/upload : réponse 202 immédiate, traitement en arrière-plan.
const findMeetingById = jest.fn();
const setMeetingAudio = jest.fn();
const setTranscriptionStatus = jest.fn();
const transcribeMeetingAudioSafely = jest.fn();

jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({ findMeetingById }));
jest.unstable_mockModule('../../src/models/meeting-detail.model.js', () => ({ setMeetingAudio }));
jest.unstable_mockModule('../../src/models/processing.model.js', () => ({ setTranscriptionStatus }));
jest.unstable_mockModule('../../src/models/transcription.model.js', () => ({
  findTranscriptionByMeeting: jest.fn(), findTranscriptionById: jest.fn(), updateTranscriptionText: jest.fn(),
}));
jest.unstable_mockModule('../../src/services/memory.service.js', () => ({ indexTranscriptionSafely: jest.fn() }));
jest.unstable_mockModule('../../src/services/meeting-pipeline.service.js', () => ({ processMeetingSafely: jest.fn() }));
jest.unstable_mockModule('../../src/services/meeting-processing.service.js', () => ({
  saveTranscription: jest.fn(), transcribeMeetingAudioSafely,
}));

const { uploadAndTranscribeHandler } = await import('../../src/controllers/transcription.controller.js');

const MEETING = '77777777-7777-4777-8777-777777777777';
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const makeFile = () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'veridian-up-')), 'audio_test.webm');
  fs.writeFileSync(filePath, 'x');
  return filePath;
};
const req = (filePath, body = {}) => ({
  file: filePath ? { path: filePath } : undefined,
  body: { meetingId: MEETING, ...body },
  user: { id: 'u-1' },
});

describe('uploadAndTranscribeHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('répond 202 tout de suite et lance le traitement sans l\'attendre', async () => {
    findMeetingById.mockResolvedValue({ id: MEETING, project_id: 'p', transcription_status: 'none', audio_path: null });
    // Le traitement ne se termine jamais : si le contrôleur l'attendait, le test bloquerait
    transcribeMeetingAudioSafely.mockReturnValue(new Promise(() => {}));
    const filePath = makeFile();
    const res = makeRes();

    await uploadAndTranscribeHandler(req(filePath), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(202);
    expect(setMeetingAudio).toHaveBeenCalledWith(MEETING, 'audio_test.webm');
    expect(setTranscriptionStatus).toHaveBeenCalledWith(MEETING, 'processing');
    expect(transcribeMeetingAudioSafely).toHaveBeenCalledWith(
      expect.objectContaining({ id: MEETING }), { id: 'u-1' }, filePath, { autoAnalyze: true });
    expect(fs.existsSync(filePath)).toBe(true); // l'audio est conservé
  });

  test('transcription déjà en cours → 409 et le fichier reçu est supprimé', async () => {
    findMeetingById.mockResolvedValue({ id: MEETING, transcription_status: 'processing' });
    const filePath = makeFile();
    const res = makeRes();
    await uploadAndTranscribeHandler(req(filePath), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(transcribeMeetingAudioSafely).not.toHaveBeenCalled();
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('non-membre → 404, fichier supprimé, rien n\'est lancé', async () => {
    findMeetingById.mockResolvedValue(undefined);
    const filePath = makeFile();
    const res = makeRes();
    await uploadAndTranscribeHandler(req(filePath), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(setMeetingAudio).not.toHaveBeenCalled();
  });

  test('aucun fichier → 400 ; meetingId invalide → 400 et fichier supprimé', async () => {
    let res = makeRes();
    await uploadAndTranscribeHandler(req(null), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);

    const filePath = makeFile();
    res = makeRes();
    await uploadAndTranscribeHandler(req(filePath, { meetingId: 'abc' }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(fs.existsSync(filePath)).toBe(false);
  });

  test('autoAnalyze=false (champ de formulaire) → transcription sans analyse', async () => {
    findMeetingById.mockResolvedValue({ id: MEETING, transcription_status: 'done', audio_path: null });
    transcribeMeetingAudioSafely.mockResolvedValue(null);
    await uploadAndTranscribeHandler(req(makeFile(), { autoAnalyze: 'false' }), makeRes(), jest.fn());
    expect(transcribeMeetingAudioSafely.mock.calls[0][3]).toEqual({ autoAnalyze: false });
  });
});
