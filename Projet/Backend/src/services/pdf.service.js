// src/services/pdf.service.js
// Génère le rapport PDF d'un projet (réunions, décisions, tâches, alertes).
// Polices PDF standard (Helvetica) : aucune police à installer, l'encodage
// WinAnsi couvre le français. Les caractères hors de cet encodage (émojis,
// flèches…) sont remplacés par « ? » au lieu de produire du texte illisible.
import PDFDocument from 'pdfkit';

const COLORS = {
  accent: '#1f6f50',
  text: '#1d2521',
  muted: '#66726c',
  line: '#d5dcd8',
  high: '#b3261e',
  medium: '#a15c00',
  low: '#4a5a52',
};

const DECISION_STATUS = {
  confirmed: 'Confirmée',
  draft: 'Brouillon',
  contradicted: 'Contredite',
  inactive: 'Inactive',
};
const TASK_STATUS = { todo: 'À faire', in_progress: 'En cours', done: 'Terminée' };
const MEETING_STATUS = {
  planned: 'Planifiée', active: 'En cours', processing: 'En traitement',
  done: 'Terminée', cancelled: 'Annulée',
};
const SEVERITY = { high: 'Élevée', medium: 'Moyenne', low: 'Faible' };

// Caractères représentables en WinAnsi (Windows-1252)
const UNSUPPORTED = /[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF\u0152\u0153\u0160\u0161\u0178\u017D\u017E\u0192\u02C6\u02DC\u2013\u2014\u2018\u2019\u201A\u201C\u201D\u201E\u2020\u2021\u2022\u2026\u2030\u2039\u203A\u20AC\u2122]/gu;

export const toPdfText = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .normalize('NFC')
    .replace(/[\u202F\u2007\u2009]/gu, ' ')
    .replace(UNSUPPORTED, '?');
};

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-CA', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Toronto',
  }).format(d);
};

// Nom de fichier ASCII sûr pour l'en-tête Content-Disposition
export const buildPdfFileName = (projectName) => {
  const slug = String(projectName ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `Veridian-${slug || 'projet'}-rapport.pdf`;
};

/**
 * @param {{
 *   project: { name: string, description?: string },
 *   meetings: Array, decisions: Array, tasks: Array, alerts: Array,
 *   generatedAt?: Date
 * }} report
 * @returns {Promise<Buffer>}
 */
export const buildProjectReportPdf = (report) => {
  const { project, meetings = [], decisions = [], tasks = [], alerts = [] } = report;
  const generatedAt = report.generatedAt ?? new Date();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 64, left: 56, right: 56 },
      bufferPages: true,
      info: {
        Title: toPdfText(`Rapport du projet ${project.name}`),
        Author: 'Veridian',
        Subject: 'Rapport de projet',
      },
    });

    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

    // Saute de page si le bloc suivant (hauteur estimée) ne tient pas
    const ensureSpace = (height) => {
      if (doc.y + height > bottomLimit()) doc.addPage();
    };

    const heading = (text) => {
      ensureSpace(60);
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(14).fillColor(COLORS.accent)
        .text(toPdfText(text), { width: contentWidth });
      const y = doc.y + 2;
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + contentWidth, y)
        .lineWidth(0.8).strokeColor(COLORS.line).stroke();
      doc.y = y + 8;
    };

    const empty = (text) => {
      doc.font('Helvetica-Oblique').fontSize(10).fillColor(COLORS.muted)
        .text(toPdfText(text), { width: contentWidth });
    };

    const label = (text, color = COLORS.muted) =>
      doc.font('Helvetica').fontSize(9).fillColor(color).text(toPdfText(text), { width: contentWidth });

    // ─── En-tête ─────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.accent).text('VERIDIAN', { characterSpacing: 2 });
    doc.moveDown(0.3);
    doc.font('Helvetica-Bold').fontSize(22).fillColor(COLORS.text)
      .text(toPdfText(project.name), { width: contentWidth });
    doc.moveDown(0.2);
    label(`Rapport généré le ${formatDate(generatedAt)}`);
    if (project.description) {
      doc.moveDown(0.5);
      doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.text)
        .text(toPdfText(project.description), { width: contentWidth });
    }

    // ─── Résumé ──────────────────────────────────────────────────────────────
    const doneTasks = tasks.filter((t) => t.status === 'done').length;
    const openAlerts = alerts.filter((a) => !a.resolved_at).length;
    heading('Résumé');
    doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.text);
    [
      `Réunions : ${meetings.length}`,
      `Décisions : ${decisions.length}`,
      `Tâches : ${tasks.length} (${doneTasks} terminée${doneTasks > 1 ? 's' : ''})`,
      `Alertes de contradiction : ${alerts.length} (${openAlerts} non résolue${openAlerts > 1 ? 's' : ''})`,
    ].forEach((line) => doc.text(toPdfText(line), { width: contentWidth }));

    // ─── Réunions ────────────────────────────────────────────────────────────
    heading('Réunions');
    if (meetings.length === 0) empty('Aucune réunion pour ce projet.');
    meetings.forEach((m) => {
      ensureSpace(34);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(COLORS.text)
        .text(toPdfText(m.title), { width: contentWidth });
      label([MEETING_STATUS[m.status] ?? m.status, formatDate(m.started_at ?? m.created_at)]
        .filter(Boolean).join('  -  '));
      doc.moveDown(0.5);
    });

    // ─── Décisions (regroupées par réunion) ──────────────────────────────────
    heading('Décisions');
    if (decisions.length === 0) empty('Aucune décision enregistrée.');
    const byMeeting = new Map();
    decisions.forEach((d) => {
      const key = d.meeting_title ?? 'Réunion';
      if (!byMeeting.has(key)) byMeeting.set(key, []);
      byMeeting.get(key).push(d);
    });
    byMeeting.forEach((list, meetingTitle) => {
      ensureSpace(50);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.accent)
        .text(toPdfText(meetingTitle), { width: contentWidth });
      doc.moveDown(0.2);
      list.forEach((d) => {
        ensureSpace(46);
        const contradicted = d.status === 'contradicted';
        doc.font('Helvetica').fontSize(10.5).fillColor(contradicted ? COLORS.muted : COLORS.text)
          .text(`-  ${toPdfText(d.content)}`, {
            width: contentWidth, indent: 0, strike: contradicted,
          });
        const meta = [
          DECISION_STATUS[d.status] ?? d.status,
          d.responsible ? `Responsable : ${d.responsible}` : null,
        ].filter(Boolean).join('  -  ');
        label(meta, contradicted ? COLORS.high : COLORS.muted);
        if (d.context) label(`Contexte : ${d.context}`);
        doc.moveDown(0.4);
      });
      doc.moveDown(0.3);
    });

    // ─── Tâches ──────────────────────────────────────────────────────────────
    heading('Tâches');
    if (tasks.length === 0) empty('Aucune tâche pour ce projet.');
    tasks.forEach((t) => {
      ensureSpace(34);
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(t.status === 'done' ? COLORS.muted : COLORS.text)
        .text(toPdfText(t.title), { width: contentWidth, strike: t.status === 'done' });
      label([
        TASK_STATUS[t.status] ?? t.status,
        t.priority ? `Priorité ${t.priority}` : null,
        t.assignee ? `Assignée à ${t.assignee}` : 'Non assignée',
        t.due_date ? `Échéance ${formatDate(t.due_date)}` : null,
      ].filter(Boolean).join('  -  '));
      doc.moveDown(0.4);
    });

    // ─── Alertes ─────────────────────────────────────────────────────────────
    heading('Alertes de contradiction');
    if (alerts.length === 0) empty('Aucune contradiction détectée.');
    alerts.forEach((a) => {
      ensureSpace(80);
      const color = COLORS[a.severity] ?? COLORS.medium;
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(color)
        .text(toPdfText(`Gravité ${SEVERITY[a.severity] ?? a.severity}${a.resolved_at ? ' - résolue' : ''}`),
          { width: contentWidth });
      doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.text)
        .text(toPdfText(`Nouvelle décision : ${a.new_decision}`), { width: contentWidth });
      doc.text(toPdfText(`Décision contredite : ${a.conflict_decision}`), { width: contentWidth });
      if (a.explanation) label(a.explanation);
      doc.moveDown(0.5);
    });

    // ─── Pieds de page (après coup, quand le nombre de pages est connu) ──────
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      const footerY = doc.page.height - 40;
      // On écrit dans la marge basse : on la met à 0 pour ne pas créer de page vide
      const savedBottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted)
        .text(toPdfText(`${project.name} - Veridian`), doc.page.margins.left, footerY,
          { width: contentWidth / 2, lineBreak: false, ellipsis: true });
      doc.text(`Page ${i + 1} / ${range.count}`, doc.page.margins.left + contentWidth / 2, footerY,
        { width: contentWidth / 2, align: 'right', lineBreak: false });
      doc.page.margins.bottom = savedBottom;
    }

    doc.end();
  });
};
