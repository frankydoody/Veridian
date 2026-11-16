import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Bloc 14 — page de détail d'une réunion et lecteur audio. Modèles simulés.
const findMeetingById = jest.fn();
const findMeetingDetails = jest.fn();

jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({ findMeetingById }));
jest.unstable_mockModule('../../src/models/meeting-detail.model.js', () => ({ findMeetingDetails, setMeetingAudio: jest.fn() }));

const { getMeetingDetailsHandler, streamMeetingAudioHandler } =
  await import('../../src/controllers/meeting-detail.controller.js');
const { UPLOAD_DIR, ensureUploadDir, resolveAudioPath } = await import('../../src/config/storage.js');

const MEETING = '55555555-5555-4555-8555-555555555555';
const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.sendFile = jest.fn();
  return res;
};
const req = (id = MEETING) => ({ params: { id }, user: { id: 'u-1' } });
const emptyDetails = { transcription: null, decisions: [], tasks: [], alerts: [], risks: [], notifications: [] };

describe('resolveAudioPath (sécurité du chemin)', () => {
  test('refuse tout ce qui sort du dossier d\'envoi', () => {
    expect(resolveAudioPath('../../.env')).toBeNull();
    expect(resolveAudioPath('..\\..\\.env')).toBeNull();
    expect(resolveAudioPath(path.resolve('/etc/passwd'))).toBeNull();
    expect(resolveAudioPath('')).toBeNull();
    expect(resolveAudioPath(null)).toBeNull();
  });

  test('accepte un fichier existant du dossier, refuse un fichier absent', () => {
    ensureUploadDir();
    const name = `test_${Date.now()}.webm`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), 'x');
    try {
      expect(resolveAudioPath(name)).toBe(path.join(UPLOAD_DIR, name));
      expect(resolveAudioPath(`absent_${name}`)).toBeNull();
    } finally {
      fs.unlinkSync(path.join(UPLOAD_DIR, name));
    }
  });
});

describe('getMeetingDetailsHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('non-membre : 404 et aucune donnée lue', async () => {
    findMeetingById.mockResolvedValue(undefined);
    const res = makeRes();
    await getMeetingDetailsHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findMeetingDetails).not.toHaveBeenCalled();
  });

  test('identifiant invalide : 400', async () => {
    const res = makeRes();
    await getMeetingDetailsHandler(req('abc'), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findMeetingById).not.toHaveBeenCalled();
  });

  test('membre : détails complets, has_audio au lieu du nom de fichier', async () => {
    findMeetingById.mockResolvedValue({ id: MEETING, title: 'Revue', audio_path: 'absent.webm' });
    findMeetingDetails.mockResolvedValue(emptyDetails);
    const res = makeRes();
    await getMeetingDetailsHandler(req(), res, jest.fn());
    const body = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body.meeting.has_audio).toBe(false);
    expect(body.meeting).not.toHaveProperty('audio_path');
    expect(body).toMatchObject(emptyDetails);
  });
});

describe('streamMeetingAudioHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  test('non-membre : 404, le fichier n\'est jamais envoyé', async () => {
    findMeetingById.mockResolvedValue(undefined);
    const res = makeRes();
    await streamMeetingAudioHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  test('réunion sans audio : 404', async () => {
    findMeetingById.mockResolvedValue({ id: MEETING, audio_path: null });
    const res = makeRes();
    await streamMeetingAudioHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('chemin piégé en base : 404 (jamais servi)', async () => {
    findMeetingById.mockResolvedValue({ id: MEETING, audio_path: '../../.env' });
    const res = makeRes();
    await streamMeetingAudioHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.sendFile).not.toHaveBeenCalled();
  });

  test('membre avec audio : fichier envoyé avec son type audio', async () => {
    ensureUploadDir();
    const name = `test_${Date.now()}.webm`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), 'x');
    try {
      findMeetingById.mockResolvedValue({ id: MEETING, audio_path: name });
      const res = makeRes();
      await streamMeetingAudioHandler(req(), res, jest.fn());
      expect(res.sendFile).toHaveBeenCalled();
      const [sentPath, options] = res.sendFile.mock.calls[0];
      expect(sentPath).toBe(path.join(UPLOAD_DIR, name));
      expect(options.headers['Content-Type']).toBe('audio/webm');
    } finally {
      fs.unlinkSync(path.join(UPLOAD_DIR, name));
    }
  });
});
