import { describe, test, expect, jest, beforeEach } from '@jest/globals';

const saveNotification = jest.fn(async (n) => ({ id: 'n-1', ...n }));
jest.unstable_mockModule('../../src/models/pipeline.model.js', () => ({ saveNotification }));

const { buildEmails, sendEmailsSafely } = await import('../../src/services/notification.service.js');

const meeting = { id: 'm-1', title: 'Revue de sprint' };
const organizer = { id: 'u-0', name: 'Admin', email: 'admin@x.ca' };
const projects = [{ id: 'p-1', name: 'Refonte', isNew: false }, { id: 'p-2', name: 'Portail', isNew: true }];
const tasks = [
  { id: 't-1', title: 'Maquettes', description: 'Écrans A et B', priority: 'haute', due_date: '2026-11-10T17:00:00Z', due_estimated: false, project_id: 'p-2', assignee: 'Marie', assignee_id: 'u-1', assignee_email: 'marie@x.ca' },
  { id: 't-2', title: 'Migrer la base', description: null, priority: 'moyenne', due_date: '2026-11-09T17:00:00Z', due_estimated: true, project_id: 'p-1', assignee: 'Gagnon', assignee_id: null, assignee_email: null },
  { id: 't-3', title: 'Revoir <script>', description: null, priority: 'basse', due_date: '2026-11-16T17:00:00Z', due_estimated: true, project_id: 'p-1', assignee: 'Marie', assignee_id: 'u-1', assignee_email: 'marie@x.ca' },
];
const base = { meeting, organizer, projects, decisions: [{ content: 'Utiliser React' }], tasks };

describe('buildEmails', () => {
  test('un courriel par acteur avec ses tâches, détails et date', () => {
    const emails = buildEmails(base);
    const actor = emails.filter((e) => e.kind === 'actor');
    expect(actor).toHaveLength(1);
    expect(actor[0].to).toBe('marie@x.ca');
    expect(actor[0].subject).toContain('2 tâche(s)');
    expect(actor[0].text).toContain('Maquettes');
    expect(actor[0].text).toContain('Écrans A et B');
    expect(actor[0].text).toContain('2026');
  });

  test('indique les dates approximatives', () => {
    const [actor] = buildEmails(base);
    expect(actor.text).toContain('date approximative');
  });

  test('le résumé de l\'organisateur liste acteurs, tâches sans acteur, décisions, alertes et risques', () => {
    const summary = buildEmails({
      ...base,
      alerts: [{ explanation: 'Contredit la décision du 3 mars' }],
      risks: [{ severity: 'high', description: 'Délai irréaliste', mitigation: 'Ajouter une personne' }],
    }).find((e) => e.kind === 'summary');
    expect(summary.to).toBe('admin@x.ca');
    expect(summary.text).toContain('Marie');
    expect(summary.text).toContain('Sans acteur identifié');
    expect(summary.text).toContain('Migrer la base');
    expect(summary.text).toContain('Utiliser React');
    expect(summary.text).toContain('Contredit la décision');
    expect(summary.text).toContain('Délai irréaliste');
    expect(summary.text).toContain('Portail (nouveau)');
  });

  test('échappe le HTML venant de l\'IA', () => {
    const summary = buildEmails(base).find((e) => e.kind === 'summary');
    expect(summary.html).not.toContain('<script>');
    expect(summary.html).toContain('&lt;script&gt;');
  });

  test('aucun courriel pour un acteur sans adresse', () => {
    const emails = buildEmails({ ...base, tasks: [tasks[1]], organizer: {} });
    expect(emails).toHaveLength(0);
  });
});

describe('sendEmailsSafely', () => {
  beforeEach(() => jest.clearAllMocks());
  const mail = { kind: 'actor', userId: 'u-1', to: 'marie@x.ca', subject: 'S', text: 't', html: 'h' };

  test('sans SMTP : mode console, statut « logged »', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const res = await sendEmailsSafely('m-1', [mail], { transport: null });
    expect(res[0].status).toBe('logged');
    expect(saveNotification).toHaveBeenCalledWith(expect.objectContaining({ status: 'logged', email: 'marie@x.ca' }));
    spy.mockRestore();
  });

  test('avec SMTP : envoie et journalise « sent »', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const res = await sendEmailsSafely('m-1', [mail], { transport: { sendMail } });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'marie@x.ca', subject: 'S' }));
    expect(res[0].status).toBe('sent');
  });

  test('un échec d\'envoi est journalisé et ne lance pas d\'erreur', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const sendMail = jest.fn().mockRejectedValue(new Error('SMTP down'));
    const res = await sendEmailsSafely('m-1', [mail, { ...mail, to: 'b@x.ca' }], { transport: { sendMail } });
    expect(res.map((r) => r.status)).toEqual(['failed', 'failed']);
    expect(res[0].error).toBe('SMTP down');
    spy.mockRestore();
  });
});
