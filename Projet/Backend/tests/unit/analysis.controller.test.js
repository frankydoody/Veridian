import { describe, test, expect, jest, beforeEach } from '@jest/globals';

const findMeetingById = jest.fn();
const findTranscriptionByMeeting = jest.fn();
const findAnalysisByMeeting = jest.fn();
const processMeeting = jest.fn();
const processMeetingSafely = jest.fn();

jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({ findMeetingById }));
jest.unstable_mockModule('../../src/models/transcription.model.js', () => ({ findTranscriptionByMeeting }));
const setAnalysisStatus = jest.fn();
jest.unstable_mockModule('../../src/models/pipeline.model.js', () => ({ findAnalysisByMeeting, setAnalysisStatus }));
jest.unstable_mockModule('../../src/services/meeting-pipeline.service.js', () => ({ processMeeting, processMeetingSafely }));

const { analyzeMeetingHandler, getAnalysisHandler } = await import('../../src/controllers/analysis.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const ID = '11111111-1111-4111-8111-111111111111';
const req = (over = {}) => ({ params: { id: ID }, query: {}, user: { id: 'u1' }, ...over });

describe('analyzeMeetingHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMeetingById.mockResolvedValue({ id: ID, analysis_status: 'none' });
    findTranscriptionByMeeting.mockResolvedValue({ raw_text: 't' });
  });

  test('400 pour un identifiant invalide, sans toucher la base', async () => {
    const res = makeRes();
    await analyzeMeetingHandler(req({ params: { id: 'abc' } }), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findMeetingById).not.toHaveBeenCalled();
  });

  test('404 si la réunion n\'est pas accessible : aucune analyse lancée', async () => {
    findMeetingById.mockResolvedValue(undefined);
    const res = makeRes();
    await analyzeMeetingHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(processMeetingSafely).not.toHaveBeenCalled();
  });

  test('409 si une analyse est déjà en cours', async () => {
    findMeetingById.mockResolvedValue({ id: ID, analysis_status: 'processing' });
    const res = makeRes();
    await analyzeMeetingHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('404 sans transcription', async () => {
    findTranscriptionByMeeting.mockResolvedValue(undefined);
    const res = makeRes();
    await analyzeMeetingHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('202 et démarrage en arrière-plan par défaut', async () => {
    const res = makeRes();
    await analyzeMeetingHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(202);
    expect(processMeetingSafely).toHaveBeenCalledWith({ id: ID, analysis_status: 'none' }, { id: 'u1' }, { notify: true });
  });

  test('?wait=true attend le résultat ; ?notify=false désactive les courriels', async () => {
    processMeeting.mockResolvedValue({ tasks: [{ id: 't' }] });
    const res = makeRes();
    await analyzeMeetingHandler(req({ query: { wait: 'true', notify: 'false' } }), res, jest.fn());
    expect(processMeeting).toHaveBeenCalledWith(expect.anything(), { id: 'u1' }, { notify: false });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ analysis_status: 'done', tasks: [{ id: 't' }] }));
  });

  test('transmet les erreurs au middleware', async () => {
    processMeeting.mockRejectedValue(new Error('x'));
    const next = jest.fn();
    await analyzeMeetingHandler(req({ query: { wait: 'true' } }), makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});

describe('getAnalysisHandler', () => {
  test('404 hors projet, sinon état + résultats', async () => {
    findMeetingById.mockResolvedValue(undefined);
    let res = makeRes();
    await getAnalysisHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findAnalysisByMeeting).not.toHaveBeenCalled();

    findMeetingById.mockResolvedValue({ id: ID, analysis_status: 'done', analysis_error: null, analyzed_at: 'x' });
    findAnalysisByMeeting.mockResolvedValue({ decisions: [], tasks: [{ id: 't' }], risks: [], notifications: [] });
    res = makeRes();
    await getAnalysisHandler(req(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ analysis_status: 'done', tasks: [{ id: 't' }] }));
  });
});
