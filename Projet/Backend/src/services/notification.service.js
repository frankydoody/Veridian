// src/services/notification.service.js
// Bloc 19 — Courriels envoyés après l'analyse d'une réunion.
// Sans SMTP_HOST dans .env : mode « console » (le courriel est affiché et journalisé,
// rien n'est envoyé). Pratique pour la démonstration et les tests.
import nodemailer from 'nodemailer';
import { saveNotification } from '../models/pipeline.model.js';

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const formatDate = (d) =>
  new Date(d).toLocaleDateString('fr-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const PRIORITY_LABEL = { haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse' };

const taskLine = (t) => {
  const approx = t.due_estimated ? ' (date approximative)' : '';
  return {
    text: `• ${t.title} — priorité ${PRIORITY_LABEL[t.priority] || t.priority}, à terminer vers le ${formatDate(t.due_date)}${approx}`
      + (t.description ? `\n    ${t.description}` : ''),
    html: `<li><strong>${escapeHtml(t.title)}</strong> — priorité ${escapeHtml(PRIORITY_LABEL[t.priority] || t.priority)}, `
      + `à terminer vers le <strong>${escapeHtml(formatDate(t.due_date))}</strong>${approx ? ' <em>(date approximative)</em>' : ''}`
      + (t.description ? `<br><span style="color:#555">${escapeHtml(t.description)}</span>` : '') + '</li>',
  };
};

/**
 * Construit les courriels (fonction pure, testable) :
 *  - un courriel par acteur ayant au moins une tâche (et une adresse),
 *  - un résumé pour l'organisateur : tous les acteurs, leurs tâches, décisions, alertes et risques.
 */
export const buildEmails = ({ meeting, organizer, projects, decisions, tasks, alerts = [], risks = [] }) => {
  const emails = [];
  const projectName = (id) => projects.find((p) => p.id === id)?.name || '';
  const subjectBase = `Veridian — ${meeting.title}`;

  // ── Un courriel par acteur ──────────────────────────────────────────────────
  const byActor = new Map();
  for (const t of tasks) {
    if (!t.assignee_id || !t.assignee_email) continue;
    if (!byActor.has(t.assignee_id)) byActor.set(t.assignee_id, { email: t.assignee_email, name: t.assignee, tasks: [] });
    byActor.get(t.assignee_id).tasks.push(t);
  }
  for (const [userId, actor] of byActor) {
    const lines = actor.tasks.map((t) => ({ ...taskLine(t), project: projectName(t.project_id) }));
    emails.push({
      kind: 'actor',
      userId,
      to: actor.email,
      subject: `${subjectBase} : ${actor.tasks.length} tâche(s) pour vous`,
      text: `Bonjour ${actor.name || ''},\n\nLa réunion « ${meeting.title} » vous a confié ${actor.tasks.length} tâche(s) :\n\n`
        + lines.map((l) => `[${l.project}] ${l.text}`).join('\n\n') + '\n\n— Veridian',
      html: `<p>Bonjour ${escapeHtml(actor.name || '')},</p>`
        + `<p>La réunion « ${escapeHtml(meeting.title)} » vous a confié <strong>${actor.tasks.length}</strong> tâche(s) :</p>`
        + `<ul>${lines.map((l) => l.html.replace('<li>', `<li>[${escapeHtml(l.project)}] `)).join('')}</ul><p>— Veridian</p>`,
    });
  }

  // ── Résumé pour l'organisateur ──────────────────────────────────────────────
  if (organizer?.email) {
    const unassigned = tasks.filter((t) => !t.assignee_id);
    const actorBlocks = [...byActor.values()];
    const text = [
      `Bonjour ${organizer.name || ''},`,
      `Voici le résultat de l'analyse de la réunion « ${meeting.title} » :`,
      `Projets concernés : ${projects.map((p) => p.name + (p.isNew ? ' (nouveau)' : '')).join(', ') || '—'}`,
      `\nACTEURS ET TÂCHES (${tasks.length} tâche(s))`,
      ...actorBlocks.map((a) => `\n${a.name} :\n${a.tasks.map((t) => taskLine(t).text).join('\n')}`),
      unassigned.length ? `\nSans acteur identifié :\n${unassigned.map((t) => taskLine(t).text).join('\n')}` : '',
      `\nDÉCISIONS (${decisions.length})`,
      ...decisions.map((d) => `• ${d.content}`),
      alerts.length ? `\nCONTRADICTIONS (${alerts.length})\n${alerts.map((a) => `• ${a.explanation}`).join('\n')}` : '',
      risks.length ? `\nRISQUES ET PROBLÈMES POSSIBLES (${risks.length})\n${risks.map((r) => `• [${r.severity}] ${r.description}${r.mitigation ? ` → ${r.mitigation}` : ''}`).join('\n')}` : '',
      '\n— Veridian',
    ].filter(Boolean).join('\n');

    const html = `<p>Bonjour ${escapeHtml(organizer.name || '')},</p>`
      + `<p>Résultat de l'analyse de la réunion « ${escapeHtml(meeting.title)} » — projets : `
      + `${escapeHtml(projects.map((p) => p.name + (p.isNew ? ' (nouveau)' : '')).join(', ') || '—')}.</p>`
      + `<h3>Acteurs et tâches</h3>`
      + actorBlocks.map((a) => `<h4>${escapeHtml(a.name)}</h4><ul>${a.tasks.map((t) => taskLine(t).html).join('')}</ul>`).join('')
      + (unassigned.length ? `<h4>Sans acteur identifié</h4><ul>${unassigned.map((t) => taskLine(t).html).join('')}</ul>` : '')
      + `<h3>Décisions (${decisions.length})</h3><ul>${decisions.map((d) => `<li>${escapeHtml(d.content)}</li>`).join('')}</ul>`
      + (alerts.length ? `<h3>Contradictions (${alerts.length})</h3><ul>${alerts.map((a) => `<li>${escapeHtml(a.explanation)}</li>`).join('')}</ul>` : '')
      + (risks.length ? `<h3>Risques et problèmes possibles (${risks.length})</h3><ul>${risks.map((r) => `<li>[${escapeHtml(r.severity)}] ${escapeHtml(r.description)}${r.mitigation ? ` → ${escapeHtml(r.mitigation)}` : ''}</li>`).join('')}</ul>` : '')
      + '<p>— Veridian</p>';

    emails.push({
      kind: 'summary',
      userId: organizer.id,
      to: organizer.email,
      subject: `${subjectBase} : résumé (${tasks.length} tâche(s), ${decisions.length} décision(s))`,
      text,
      html,
    });
  }

  return emails;
};

// Transport SMTP créé à la demande ; null = mode console
const createTransport = () => {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
};

/**
 * Envoie les courriels et journalise chaque envoi. Ne lance jamais d'erreur :
 * un courriel qui échoue ne doit pas faire échouer l'analyse.
 */
export const sendEmailsSafely = async (meetingId, emails, { transport = createTransport() } = {}) => {
  const from = process.env.MAIL_FROM || 'Veridian <no-reply@veridian.local>';
  const results = [];

  for (const mail of emails) {
    let status = 'logged';
    let error = null;
    try {
      if (transport) {
        await transport.sendMail({ from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
        status = 'sent';
      } else {
        console.log(`\n📧 [Courriel simulé] À : ${mail.to}\nObjet : ${mail.subject}\n${mail.text}\n`);
      }
    } catch (e) {
      status = 'failed';
      error = e.message;
      console.error('[Courriel] Échec pour', mail.to, ':', e.message);
    }
    try {
      results.push(await saveNotification({
        meetingId, userId: mail.userId, email: mail.to, subject: mail.subject,
        kind: mail.kind, status, error,
      }));
    } catch (e) {
      console.error('[Courriel] Journalisation échouée :', e.message);
      results.push({ email: mail.to, subject: mail.subject, kind: mail.kind, status, error });
    }
  }
  return results;
};
