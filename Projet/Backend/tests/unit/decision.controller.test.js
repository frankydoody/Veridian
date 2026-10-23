import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 08 : l'extraction des décisions déclenche la détection des contradictions,
// et son résultat est joint à la réponse (aucune base, aucun réseau).

const createDecisions = jest.fn();
const findMeetingById = jest.fn();
const findTranscriptionByMeeting = jest.fn();
const extractDecisions = jest.fn();
const indexDecisionsSafely = jest.fn();
const checkContradictionsSafely = jest.fn();

jest.unstable_mockModule('../../src/models/decision.model.js', () => ({
  createDecisions, findDecisionsByMeeting: jest.fn(), findDecisionsByProject: jest.fn(),
}));
jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({ findMeetingById }));
jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectById: jest.fn() }));
jest.unstable_mockModule('../../src/models/transcription.model.js', () => ({ findTranscriptionByMeeting }));
jest.unstable_mockModule('../../src/services/ia.service.js', () => ({ extractDecisions }));
jest.unstable_mockModule('../../src/services/memory.service.js', () => ({ indexDecisionsSafely }));
jest.unstable_mockModule('../../src/services/contradiction.service.js', () => ({ checkContradictionsSafely }));

const { extractDecisionsHandler } = await import('../../src/controllers/decision.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const req = { params: { meetingId: 'm-2' }, user: { id: 'u1' } };

describe('extractDecisionsHandler (bloc 08)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findMeetingById.mockResolvedValue({ id: 'm-2', project_id: 'p-1' });
    findTranscriptionByMeeting.mockResolvedValue({ raw_text: 'texte' });
  });

  test('compare les décisions créées aux décisions passées du projet et joint le résultat', async () => {
    const decisions = [{ id: 'd-1', content: 'x' }];
    extractDecisions.mockResolvedValue([{ content: 'x' }]);
    createDecisions.mockResolvedValue(decisions);
    indexDecisionsSafely.mockResolvedValue({ indexed: true, stored: 1 });
    checkContradictionsSafely.mockResolvedValue({ checked: true, count: 1, alerts: [{ id: 'a-1' }] });

    const res = makeRes();
    await extractDecisionsHandler(req, res, jest.fn());

    expect(checkContradictionsSafely).toHaveBeenCalledWith('m-2', 'p-1', decisions);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].contradictions).toEqual({ checked: true, count: 1, alerts: [{ id: 'a-1' }] });
  });

  test('ne lance pas la détection quand la réunion n\'est pas accessible', async () => {
    findMeetingById.mockResolvedValue(undefined);

    const res = makeRes();
    await extractDecisionsHandler(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(checkContradictionsSafely).not.toHaveBeenCalled();
  });

  test('ne lance pas la détection quand aucune décision n\'est trouvée', async () => {
    extractDecisions.mockResolvedValue([]);

    const res = makeRes();
    await extractDecisionsHandler(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(200);
    expect(checkContradictionsSafely).not.toHaveBeenCalled();
  });
});
