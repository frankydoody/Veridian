import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 19 : orchestration du pipeline (aucune base, aucun réseau, aucune IA réelle).

const findProjectsByUser = jest.fn();
const findTranscriptionByMeeting = jest.fn();
const findKnownUsers = jest.fn();
const setAnalysisStatus = jest.fn();
const findProjectHistory = jest.fn();
const persistAnalysis = jest.fn();
const saveRisks = jest.fn();
const analyzeMeeting = jest.fn();
const assessProjectRisks = jest.fn();
const indexDecisionsSafely = jest.fn();
const checkContradictionsSafely = jest.fn();
const buildEmails = jest.fn();
const sendEmailsSafely = jest.fn();

jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectsByUser }));
jest.unstable_mockModule('../../src/models/transcription.model.js', () => ({ findTranscriptionByMeeting }));
jest.unstable_mockModule('../../src/models/pipeline.model.js', () => ({
  findKnownUsers, setAnalysisStatus, findProjectHistory, persistAnalysis, saveRisks,
}));
jest.unstable_mockModule('../../src/services/ia.service.js', () => ({ analyzeMeeting, assessProjectRisks }));
jest.unstable_mockModule('../../src/services/memory.service.js', () => ({ indexDecisionsSafely }));
jest.unstable_mockModule('../../src/services/contradiction.service.js', () => ({ checkContradictionsSafely }));
jest.unstable_mockModule('../../src/services/notification.service.js', () => ({ buildEmails, sendEmailsSafely }));

const { processMeeting, processMeetingSafely } = await import('../../src/services/meeting-pipeline.service.js');

const NOW = new Date('2026-11-02T14:00:00Z');
const user = { id: 'u-0', name: 'Admin', email: 'admin@x.ca' };
const meeting = { id: 'm-1', project_id: 'p-1', project_name: 'Refonte', title: 'Revue' };
const projects = [{ id: 'p-1', name: 'Refonte' }];

describe('processMeeting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findTranscriptionByMeeting.mockResolvedValue({ raw_text: 'Marie fera les maquettes' });
    findProjectsByUser.mockResolvedValue(projects);
    findKnownUsers.mockResolvedValue([{ id: 'u-1', name: 'Marie Tremblay', email: 'marie@x.ca' }]);
    analyzeMeeting.mockResolvedValue({
      projects: [],
      decisions: [{ content: 'Utiliser React' }],
      tasks: [{ title: 'Maquettes', assignee: 'Marie', priority: 'haute' }],
    });
    findProjectHistory.mockResolvedValue({ decisions: [{ content: 'Utiliser Vue' }], openTasks: [] });
    persistAnalysis.mockImplementation(async (m, uid, n) => ({
      projects: [{ id: 'p-1', name: 'Refonte', isNew: false }],
      decisions: [{ id: 'd-1', project_id: 'p-1', content: 'Utiliser React' }],
      tasks: [{ id: 't-1', project_id: 'p-1', title: 'Maquettes', assignee_id: n.tasks[0].assigneeId }],
    }));
    checkContradictionsSafely.mockResolvedValue({ checked: true, count: 1, alerts: [{ id: 'a-1', explanation: 'x' }] });
    assessProjectRisks.mockResolvedValue([{ kind: 'risque', description: 'Délai serré', severity: 'high' }]);
    saveRisks.mockImplementation(async (pid, mid, risks) => risks.map((r, i) => ({ id: `r-${i}`, ...r })));
    buildEmails.mockReturnValue([{ kind: 'summary', to: 'admin@x.ca' }]);
    sendEmailsSafely.mockResolvedValue([{ status: 'logged' }]);
  });

  test('enchaîne analyse, enregistrement, mémoire, contradictions, risques et courriels', async () => {
    const result = await processMeeting(meeting, user, { now: NOW });

    expect(setAnalysisStatus).toHaveBeenNthCalledWith(1, 'm-1', 'processing');
    expect(setAnalysisStatus).toHaveBeenLastCalledWith('m-1', 'done');
    // l'acteur « Marie » a été lié à l'utilisateur avant l'enregistrement
    expect(persistAnalysis.mock.calls[0][2].tasks[0].assigneeId).toBe('u-1');
    expect(indexDecisionsSafely).toHaveBeenCalledWith('m-1', 'p-1', expect.any(Array));
    expect(checkContradictionsSafely).toHaveBeenCalledWith('m-1', 'p-1', expect.any(Array));
    expect(assessProjectRisks).toHaveBeenCalled();
    expect(sendEmailsSafely).toHaveBeenCalledWith('m-1', expect.any(Array));
    expect(result.alerts).toHaveLength(1);
    expect(result.risks).toHaveLength(1);
    expect(result.notifications).toHaveLength(1);
  });

  test('l\'historique est lu AVANT l\'enregistrement', async () => {
    const order = [];
    findProjectHistory.mockImplementation(async () => { order.push('history'); return { decisions: [{ content: 'a' }], openTasks: [] }; });
    persistAnalysis.mockImplementation(async () => { order.push('persist'); return { projects: [], decisions: [], tasks: [] }; });
    await processMeeting(meeting, user, { now: NOW });
    expect(order).toEqual(['history', 'persist']);
  });

  test('pas de courriel avec notify = false', async () => {
    await processMeeting(meeting, user, { notify: false, now: NOW });
    expect(sendEmailsSafely).not.toHaveBeenCalled();
  });

  test('pas d\'analyse de risques pour un projet nouveau ou sans historique', async () => {
    findProjectHistory.mockResolvedValue({ decisions: [], openTasks: [] });
    await processMeeting(meeting, user, { now: NOW });
    expect(assessProjectRisks).not.toHaveBeenCalled();

    jest.clearAllMocks();
    persistAnalysis.mockResolvedValue({ projects: [{ id: 'p-9', name: 'Neuf', isNew: true }], decisions: [{ id: 'd', project_id: 'p-9' }], tasks: [] });
    findTranscriptionByMeeting.mockResolvedValue({ raw_text: 't' });
    findProjectsByUser.mockResolvedValue(projects);
    findKnownUsers.mockResolvedValue([]);
    analyzeMeeting.mockResolvedValue({});
    findProjectHistory.mockResolvedValue({ decisions: [{ content: 'a' }], openTasks: [] });
    checkContradictionsSafely.mockResolvedValue({ alerts: [] });
    buildEmails.mockReturnValue([]);
    sendEmailsSafely.mockResolvedValue([]);
    await processMeeting(meeting, user, { now: NOW });
    expect(assessProjectRisks).not.toHaveBeenCalled();
  });

  test('une analyse des risques qui échoue ne fait pas échouer la réunion', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    assessProjectRisks.mockRejectedValue(new Error('quota'));
    const result = await processMeeting(meeting, user, { now: NOW });
    expect(result.risks).toEqual([]);
    expect(setAnalysisStatus).toHaveBeenLastCalledWith('m-1', 'done');
    spy.mockRestore();
  });

  test('une erreur de l\'IA passe la réunion en « error » et se propage', async () => {
    analyzeMeeting.mockRejectedValue(new Error('JSON invalide'));
    await expect(processMeeting(meeting, user, { now: NOW })).rejects.toThrow('JSON invalide');
    expect(setAnalysisStatus).toHaveBeenLastCalledWith('m-1', 'error', 'JSON invalide');
    expect(persistAnalysis).not.toHaveBeenCalled();
  });

  test('sans transcription : erreur claire', async () => {
    findTranscriptionByMeeting.mockResolvedValue(undefined);
    await expect(processMeeting(meeting, user, { now: NOW })).rejects.toThrow('Aucune transcription');
  });

  test('processMeetingSafely ne lance jamais d\'erreur', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    analyzeMeeting.mockRejectedValue(new Error('boom'));
    await expect(processMeetingSafely(meeting, user, { now: NOW })).resolves.toBeNull();
    spy.mockRestore();
  });
});
