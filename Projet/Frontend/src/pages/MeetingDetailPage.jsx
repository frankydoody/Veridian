// src/pages/MeetingDetailPage.jsx — détail d'une réunion (bloc 14)
// GET /api/meetings/:id/details (tout en un appel), GET /api/meetings/:id/audio (protégé),
// PUT /api/transcriptions/:id (modifier la transcription → la mémoire est ré-indexée).
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import TaskFormModal from '../components/TaskFormModal.jsx'
import { Button, FormError, inputStyle } from '../components/form.jsx'
import { formatDateTime, formatDueDate, isOverdue } from '../utils/dates.js'
import {
  MEETING_STATUS, ANALYSIS_STATUS, TASK_STATUS, PRIORITY, SEVERITY, labelOf,
} from '../utils/labels.js'

const RISK_KIND = { risque: 'Risque', incoherence: 'Incohérence', echeance: 'Échéance', dependance: 'Dépendance' }
const EMAIL_STATUS = {
  sent:   { label: 'Envoyé',  color: 'var(--color-success)' },
  logged: { label: 'Simulé (console)', color: 'var(--color-amber)' },
  failed: { label: 'Échec',   color: 'var(--color-danger)' },
}

const card = {
  background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '1.25rem',
}

function Badge({ label, color }) {
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
      border: `1px solid ${color}`, color, whiteSpace: 'nowrap',
    }}>{label}</span>
  )
}

function Section({ id, title, count, action, children }) {
  return (
    <section style={card} aria-labelledby={id}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <h2 id={id} style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
          {title}{count !== undefined && <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}> ({count})</span>}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const Empty = ({ children }) => <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-muted)' }}>{children}</p>

// Lecteur audio : le fichier est téléchargé AVEC le jeton (une balise <audio src> ne peut pas
// envoyer l'en-tête Authorization), puis joué depuis une URL locale au navigateur.
function AudioPlayer({ meetingId }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let objectUrl = null
    let cancelled = false
    api.blob(`/meetings/${meetingId}/audio`)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((err) => { if (!cancelled) setError(err.message) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl) // libère la mémoire en quittant la page
    }
  }, [meetingId])

  if (error) return <FormError message={`Audio indisponible : ${error}`} />
  if (!url) return <Empty>Chargement de l'audio…</Empty>
  return <audio controls src={url} style={{ width: '100%' }} aria-label="Enregistrement de la réunion" />
}

function TranscriptionSection({ transcription, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(transcription?.raw_text ?? '')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!text.trim()) { setError('La transcription ne peut pas être vide'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      const data = await api.put(`/transcriptions/${transcription.id}`, { rawText: text })
      setEditing(false)
      setNotice(data.memory?.indexed
        ? `Transcription enregistrée ; mémoire ré-indexée (${data.memory.stored} segment(s)).`
        : 'Transcription enregistrée. La mémoire n\'a pas pu être ré-indexée (clé Gemini absente ou invalide, ou quota atteint : voir la console du backend).')
      onSaved(data.transcription)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Section
      id="transcription-title"
      title="Transcription"
      action={transcription && !editing && (
        <Button variant="secondary" onClick={() => { setText(transcription.raw_text); setEditing(true); setNotice('') }}>Modifier</Button>
      )}
    >
      {!transcription && <Empty>Aucune transcription pour cette réunion.</Empty>}
      {notice && <p role="status" style={{ fontSize: '12px', color: 'var(--color-success)', margin: '0 0 0.75rem' }}>{notice}</p>}
      <FormError message={error} />
      {transcription && !editing && (
        <>
          <div style={{
            whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: 1.65, maxHeight: '320px', overflowY: 'auto',
            color: 'var(--color-text)', paddingRight: '0.5rem',
          }}>
            {transcription.raw_text}
          </div>
          <p style={{ margin: '0.75rem 0 0', fontSize: '11px', color: 'var(--color-text-faint)' }}>
            {transcription.is_edited ? 'Modifiée' : 'Transcrite'} le {formatDateTime(transcription.updated_at ?? transcription.created_at)}
          </p>
        </>
      )}
      {editing && (
        <>
          <label htmlFor="transcription-text" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            Corrigez le texte (noms propres, mots mal reconnus). La mémoire sera ré-indexée.
          </label>
          <textarea id="transcription-text" value={text} onChange={(e) => setText(e.target.value)}
            style={{ ...inputStyle, minHeight: '240px', marginTop: '0.4rem', resize: 'vertical', lineHeight: 1.6 }} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            <Button variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Annuler</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </>
      )}
    </Section>
  )
}

export default function MeetingDetailPage() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [taskForm, setTaskForm] = useState(null) // null | { task: null } | { task }

  const load = useCallback(() => {
    return api.get(`/meetings/${id}/details`)
      .then((d) => { setData(d); setError('') })
      .catch((err) => setError(err.status === 404 ? 'Réunion introuvable ou accès non autorisé.' : err.message))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Chargement de la réunion…</p>
  if (error) {
    return (
      <div>
        <FormError message={error} />
        <Link to="/meetings" style={{ color: 'var(--color-ai)', fontSize: '13px' }}>← Retour aux réunions</Link>
      </div>
    )
  }

  const { meeting, transcription, decisions, tasks, alerts, risks, notifications } = data
  const status = labelOf(MEETING_STATUS, meeting.status)
  const analysis = labelOf(ANALYSIS_STATUS, meeting.analysis_status ?? 'none')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* En-tête */}
      <div>
        <Link to="/meetings" style={{ color: 'var(--color-text-muted)', fontSize: '12px', textDecoration: 'none' }}>← Réunions</Link>
        <h1 style={{ margin: '0.25rem 0 0.4rem', fontSize: '1.5rem', fontWeight: 700 }}>{meeting.title}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px' }}>
          <Link to={`/projects/${meeting.project_id}`} style={{ color: 'var(--color-ai)' }}>{meeting.project_name}</Link>
          <Badge {...status} />
          <Badge {...analysis} />
          <span style={{ color: 'var(--color-text-faint)', fontSize: '12px' }}>Créée le {formatDateTime(meeting.created_at)}</span>
        </div>
        {meeting.description && (
          <p style={{ margin: '0.5rem 0 0', fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '75ch' }}>{meeting.description}</p>
        )}
        {meeting.analysis_status === 'error' && meeting.analysis_error && (
          <div style={{ marginTop: '0.75rem' }}><FormError message={`Dernière analyse en échec : ${meeting.analysis_error}`} /></div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Section id="audio-title" title="Enregistrement">
            {meeting.has_audio ? <AudioPlayer meetingId={meeting.id} /> : <Empty>Aucun enregistrement audio.</Empty>}
          </Section>
          <TranscriptionSection
            key={transcription?.id ?? 'aucune'}
            transcription={transcription}
            onSaved={(t) => setData((d) => ({ ...d, transcription: { ...d.transcription, ...t } }))}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <Section id="decisions-title" title="Décisions" count={decisions.length}>
            {decisions.length === 0 && <Empty>Aucune décision.</Empty>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {decisions.map((d) => (
                <li key={d.id} style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '13px' }}>
                  <span style={{ textDecoration: d.status === 'contradicted' ? 'line-through' : 'none' }}>{d.content}</span>
                  {d.status === 'contradicted' && <span style={{ color: 'var(--color-amber)', fontSize: '11px' }}> · contredite</span>}
                  {d.responsible && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Responsable : {d.responsible}</div>}
                  {d.project_id !== meeting.project_id && (
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Projet : {d.project_name}</div>
                  )}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            id="tasks-title"
            title="Tâches"
            count={tasks.length}
            action={<Button variant="secondary" onClick={() => setTaskForm({ task: null })}>+ Tâche</Button>}
          >
            {tasks.length === 0 && <Empty>Aucune tâche.</Empty>}
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {tasks.map((t) => {
                const late = isOverdue(t)
                return (
                  <li key={t.id} style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--color-border)' }}>
                    <button onClick={() => setTaskForm({ task: t })} title="Modifier la tâche" style={{
                      background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left',
                      color: 'var(--color-text)', fontSize: '13px', fontWeight: 500, fontFamily: 'inherit',
                      textDecoration: t.status === 'done' ? 'line-through' : 'none',
                    }}>{t.title}</button>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span>{t.assignee ?? 'Personne'}</span>
                      <span>·</span>
                      <span style={{ color: late ? 'var(--color-danger)' : undefined }}>
                        {t.due_date ? `${t.due_estimated ? 'vers le ' : 'le '}${formatDueDate(t.due_date)}${t.due_estimated ? ' (estimée)' : ''}` : 'sans échéance'}
                        {late && ' · en retard'}
                      </span>
                      <span>·</span>
                      <span style={{ color: labelOf(PRIORITY, t.priority).color }}>{labelOf(PRIORITY, t.priority).label}</span>
                      <span>·</span>
                      <span>{labelOf(TASK_STATUS, t.status).label}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Section>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <Section id="alerts-title" title="Contradictions" count={alerts.length}
          action={alerts.length > 0 && <Link to="/decisions" style={{ fontSize: '12px', color: 'var(--color-ai)' }}>Résoudre →</Link>}>
          {alerts.length === 0 && <Empty>Aucune contradiction détectée.</Empty>}
          {alerts.map((a) => (
            <div key={a.id} style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '13px', opacity: a.resolved_at ? 0.6 : 1 }}>
              <Badge {...labelOf(SEVERITY, a.severity)} /> {a.resolved_at && <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>résolue</span>}
              <div style={{ marginTop: '0.35rem' }}><strong>Nouvelle :</strong> {a.new_decision}</div>
              <div><strong>Contredit :</strong> <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>{a.conflict_decision}</span>
                <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}> ({a.conflict_meeting_title})</span></div>
              {a.explanation && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{a.explanation}</div>}
            </div>
          ))}
        </Section>

        <Section id="risks-title" title="Risques et problèmes possibles" count={risks.length}>
          {risks.length === 0 && <Empty>Aucun risque signalé.</Empty>}
          {risks.map((r) => (
            <div key={r.id} style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '13px' }}>
              <Badge {...labelOf(SEVERITY, r.severity)} />{' '}
              <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{RISK_KIND[r.kind] ?? r.kind}</span>
              <div style={{ marginTop: '0.35rem' }}>{r.description}</div>
              {r.mitigation && <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Mesure recommandée : {r.mitigation}</div>}
            </div>
          ))}
        </Section>

        <Section id="emails-title" title="Courriels" count={notifications.length}>
          {notifications.length === 0 && <Empty>Aucun courriel pour cette réunion.</Empty>}
          {notifications.map((n) => {
            const st = labelOf(EMAIL_STATUS, n.status)
            return (
              <div key={n.id} style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--color-border)', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                  <span>{n.email}</span><Badge {...st} />
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {n.kind === 'summary' ? 'Résumé organisateur' : 'Tâches de l\'acteur'} · {n.subject}
                </div>
                {n.error && <div style={{ fontSize: '12px', color: 'var(--color-danger)' }}>{n.error}</div>}
              </div>
            )
          })}
        </Section>
      </div>

      {taskForm && (
        <TaskFormModal
          task={taskForm.task}
          defaults={{ projectId: meeting.project_id, meetingId: meeting.id }}
          onClose={() => setTaskForm(null)}
          onSaved={() => { setTaskForm(null); load() }}
          onDeleted={() => { setTaskForm(null); load() }}
        />
      )}
    </div>
  )
}
