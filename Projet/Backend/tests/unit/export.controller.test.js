import { describe, test, expect, jest, beforeEach } from '@jest/globals';

// Bloc 09 : contrôle d'accès de l'export PDF.

const findProjectById = jest.fn();
const findMeetingsByProject = jest.fn();
const findDecisionsByProject = jest.fn();
const findTasksByProject = jest.fn();
const findAlertsByProject = jest.fn();
const buildProjectReportPdf = jest.fn();

jest.unstable_mockModule('../../src/models/project.model.js', () => ({ findProjectById }));
jest.unstable_mockModule('../../src/models/meeting.model.js', () => ({ findMeetingsByProject }));
jest.unstable_mockModule('../../src/models/decision.model.js', () => ({ findDecisionsByProject }));
jest.unstable_mockModule('../../src/models/task.model.js', () => ({ findTasksByProject }));
jest.unstable_mockModule('../../src/models/alert.model.js', () => ({ findAlertsByProject }));
jest.unstable_mockModule('../../src/services/pdf.service.js', () => ({
  buildProjectReportPdf,
  buildPdfFileName: (n) => `Veridian-${n}-rapport.pdf`,
}));

const { exportProjectPdfHandler } = await import('../../src/controllers/export.controller.js');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
};
const UUID = '3f2b8c1e-5a4d-4e8f-9b1a-2c3d4e5f6a7b';

beforeEach(() => jest.clearAllMocks());

describe('exportProjectPdfHandler', () => {
  test('400 si l\'identifiant n\'est pas un UUID', async () => {
    const res = makeRes();
    await exportProjectPdfHandler({ params: { id: 'abc' }, user: { id: 'u1' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(findProjectById).not.toHaveBeenCalled();
  });

  test('404 et AUCUNE donnée lue si l\'utilisateur n\'est pas membre', async () => {
    findProjectById.mockResolvedValue(undefined);
    const res = makeRes();
    await exportProjectPdfHandler({ params: { id: UUID }, user: { id: 'intrus' } }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(findDecisionsByProject).not.toHaveBeenCalled();
    expect(findTasksByProject).not.toHaveBeenCalled();
    expect(buildProjectReportPdf).not.toHaveBeenCalled();
  });

  test('200 avec les bons en-têtes pour un membre', async () => {
    const pdf = Buffer.from('%PDF-1.3 test');
    findProjectById.mockResolvedValue({ id: UUID, name: 'Alpha' });
    findMeetingsByProject.mockResolvedValue([]);
    findDecisionsByProject.mockResolvedValue([]);
    findTasksByProject.mockResolvedValue([]);
    findAlertsByProject.mockResolvedValue([]);
    buildProjectReportPdf.mockResolvedValue(pdf);

    const res = makeRes();
    await exportProjectPdfHandler({ params: { id: UUID }, user: { id: 'u1' } }, res, jest.fn());

    expect(findMeetingsByProject).toHaveBeenCalledWith(UUID, 'u1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="Veridian-Alpha-rapport.pdf"');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(pdf);
  });

  test('une erreur de lecture est transmise au middleware d\'erreurs', async () => {
    findProjectById.mockResolvedValue({ id: UUID, name: 'Alpha' });
    findMeetingsByProject.mockRejectedValue(new Error('db'));
    findDecisionsByProject.mockResolvedValue([]);
    findTasksByProject.mockResolvedValue([]);
    findAlertsByProject.mockResolvedValue([]);
    const next = jest.fn();
    await exportProjectPdfHandler({ params: { id: UUID }, user: { id: 'u1' } }, makeRes(), next);
    expect(next).toHaveBeenCalled();
  });
});
