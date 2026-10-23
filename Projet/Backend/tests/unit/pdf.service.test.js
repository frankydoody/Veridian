import { describe, test, expect } from '@jest/globals';
import { buildProjectReportPdf, buildPdfFileName, toPdfText } from '../../src/services/pdf.service.js';

// Bloc 09 : génération du PDF (aucune base, aucun réseau).

const baseReport = () => ({
  project: { name: 'Refonte du site web client', description: 'Migration vers une nouvelle pile technique' },
  meetings: [{ title: 'Revue de sprint', status: 'done', started_at: '2026-03-02T15:00:00Z', created_at: '2026-03-01T10:00:00Z' }],
  decisions: [
    { content: 'Utiliser React avec Vite', context: 'Équipe déjà formée', responsible: 'Marie Tremblay', status: 'contradicted', meeting_title: 'Revue de sprint' },
    { content: 'Héberger sur Cloudflare', status: 'confirmed', meeting_title: 'Revue de sprint' },
  ],
  tasks: [
    { title: 'Maquettes de la page d\'accueil', status: 'todo', priority: 'haute', assignee: 'Samuel Gagnon', due_date: '2026-04-01T00:00:00Z' },
    { title: 'Configurer le CI', status: 'done', priority: 'basse', assignee: null },
  ],
  alerts: [{ severity: 'high', resolved_at: null, new_decision: 'Passer à Vue', conflict_decision: 'Utiliser React avec Vite', explanation: 'Deux frameworks incompatibles' }],
  generatedAt: new Date('2026-10-21T12:00:00Z'),
});

describe('buildProjectReportPdf', () => {
  test('produit un vrai PDF (en-tête %PDF, fin %%EOF)', async () => {
    const buf = await buildProjectReportPdf(baseReport());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.subarray(-10).toString()).toContain('%%EOF');
    expect(buf.length).toBeGreaterThan(1500);
  });

  test('fonctionne avec un projet vide', async () => {
    const buf = await buildProjectReportPdf({ project: { name: 'Vide' } });
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('un gros projet s\'étend sur plusieurs pages sans erreur', async () => {
    const report = baseReport();
    report.decisions = Array.from({ length: 200 }, (_, i) => ({
      content: `Décision numéro ${i} avec un texte assez long pour occuper de la place sur la page`,
      status: 'confirmed', meeting_title: `Réunion ${i % 7}`,
    }));
    const buf = await buildProjectReportPdf(report);
    const pages = (buf.toString('latin1').match(/\/Type \/Page\b/g) || []).length;
    expect(pages).toBeGreaterThan(3);
  });

  test('accepte des caractères hors Windows-1252 (émojis) sans planter', async () => {
    const report = baseReport();
    report.project.name = 'Projet 🚀 « test » → ok';
    await expect(buildProjectReportPdf(report)).resolves.toBeInstanceOf(Buffer);
  });
});

describe('toPdfText', () => {
  test('conserve les accents français et les guillemets typographiques', () => {
    expect(toPdfText('Décision « prise » à l\'été – œuvre')).toBe('Décision « prise » à l\'été – œuvre');
  });

  test('remplace les caractères non supportés', () => {
    expect(toPdfText('Go 🚀 →')).toBe('Go ? ?');
  });

  test('gère null et undefined', () => {
    expect(toPdfText(null)).toBe('');
    expect(toPdfText(undefined)).toBe('');
  });
});

describe('buildPdfFileName', () => {
  test('retire les accents et les caractères spéciaux', () => {
    expect(buildPdfFileName('Refonte du site web (client) é/à')).toBe('Veridian-Refonte-du-site-web-client-e-a-rapport.pdf');
  });

  test('nom par défaut si rien d\'exploitable', () => {
    expect(buildPdfFileName('🚀🚀')).toBe('Veridian-projet-rapport.pdf');
  });
});
