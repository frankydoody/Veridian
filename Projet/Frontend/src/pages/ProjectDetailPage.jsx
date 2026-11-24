// src/pages/ProjectDetailPage.jsx — détail d'un projet : membres et réunions (bloc 13)
// GET /api/projects/:id, GET/POST/DELETE /api/projects/:id/members, GET /api/meetings/project/:id
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import MeetingFormModal from '../components/MeetingFormModal.jsx'
import { Field, FormError, Button, inputStyle } from '../components/form.jsx'
import { validateMemberEmail, hasErrors } from '../utils/validation.js'
import { formatDate, formatDateTime } from '../utils/dates.js'
import { MEETING_STATUS, labelOf } from '../utils/labels.js'

const card = {
  background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '1.25rem',
}

function MembersCard({ projectId, isOwner }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    return api.get(`/projects/${projectId}/members`)
      .then((data) => { setMembers(data.members ?? []); setError('') })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function addMember(e) {
    e.preventDefault()
    const found = validateMemberEmail(email)
    setEmailError(found.email ?? '')
    if (hasErrors(found)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await api.post(`/projects/${projectId}/members`, { email: email.trim() })
      setNotice(data.message)
      setEmail('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(member) {
    if (!window.confirm(`Retirer ${member.name} du projet ? Ses tâches restent dans le projet.`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await api.delete(`/projects/${projectId}/members/${member.id}`)
      setNotice(data?.message ?? 'Membre retiré')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section style={card} aria-labelledby="members-title">
      <h2 id="members-title" style={{ margin: '0 0 0.75rem', fontSize: '15px', fontWeight: 600 }}>
        Membres {!loading && `(${members.length})`}
      </h2>
      <p style={{ margin: '0 0 1rem', fontSize: '12px', color: 'var(--color-text-muted)' }}>
        Seuls les membres peuvent recevoir une tâche de ce projet.
      </p>
      <FormError message={error} />
      {notice && <p role="status" style={{ fontSize: '13px', color: 'var(--color-success)', margin: '0 0 0.75rem' }}>{notice}</p>}

      {loading && <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Chargement…</p>}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {members.map((m) => (
          <li key={m.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
            padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)',
          }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>
                {m.name} {m.role === 'owner' && <span style={{ fontSize: '11px', color: 'var(--color-ai)' }}>· propriétaire</span>}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{m.email} · depuis le {formatDate(m.joined_at)}</div>
            </div>
            {isOwner && m.role !== 'owner' && (
              <Button variant="danger" onClick={() => removeMember(m)} disabled={busy}
                aria-label={`Retirer ${m.name}`} style={{ padding: '0.3rem 0.7rem', fontSize: '12px' }}>
                Retirer
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isOwner && (
        <form onSubmit={addMember} noValidate style={{ marginTop: '1rem' }}>
          <Field id="member-email" label="Ajouter un membre (courriel d'un compte existant)" error={emailError}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input id="member-email" type="email" style={inputStyle} value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="personne@entreprise.com" />
              <Button type="submit" disabled={busy}>Ajouter</Button>
            </div>
          </Field>
        </form>
      )}
    </section>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showMeetingForm, setShowMeetingForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.get(`/projects/${id}`), api.get(`/meetings/project/${id}`)])
      .then(([p, m]) => {
        if (cancelled) return
        setProject(p.project)
        setMeetings(m.meetings ?? [])
      })
      .catch((err) => { if (!cancelled) setError(err.status === 404 ? 'Projet introuvable ou accès non autorisé.' : err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Chargement du projet…</p>
  if (error) {
    return (
      <div>
        <FormError message={error} />
        <Link to="/projects" style={{ color: 'var(--color-ai)', fontSize: '13px' }}>← Retour aux projets</Link>
      </div>
    )
  }

  const isOwner = project.owner_id === user?.id

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div>
        <Link to="/projects" style={{ color: 'var(--color-text-muted)', fontSize: '12px', textDecoration: 'none' }}>← Projets</Link>
        <h1 style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 700 }}>{project.name}</h1>
        {project.description && (
          <p style={{ margin: '0.4rem 0 0', fontSize: '13px', color: 'var(--color-text-muted)', maxWidth: '70ch' }}>{project.description}</p>
        )}
        <p style={{ margin: '0.4rem 0 0', fontSize: '12px', color: 'var(--color-text-faint)' }}>
          Créé le {formatDate(project.created_at)}{isOwner ? ' · vous êtes propriétaire' : ''}
          {' · '}<Link to={`/calendar?projet=${project.id}`} style={{ color: 'var(--color-ai)' }}>Voir le calendrier du projet</Link>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <MembersCard projectId={project.id} isOwner={isOwner} />

        <section style={card} aria-labelledby="meetings-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h2 id="meetings-title" style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Réunions ({meetings.length})</h2>
            <Button onClick={() => setShowMeetingForm(true)}>+ Nouvelle réunion</Button>
          </div>
          {meetings.length === 0 && (
            <p style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>Aucune réunion pour ce projet.</p>
          )}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {meetings.map((m) => (
              <li key={m.id} style={{ padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)' }}>
                <Link to={`/meetings/${m.id}`} style={{ color: 'var(--color-text)', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}>
                  {m.title}
                </Link>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {labelOf(MEETING_STATUS, m.status).label} · {m.scheduled_at ? `prévue le ${formatDateTime(m.scheduled_at)}` : formatDateTime(m.created_at)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {showMeetingForm && (
        <MeetingFormModal
          projectId={project.id}
          onClose={() => setShowMeetingForm(false)}
          onCreated={(meeting) => navigate(`/meetings/${meeting.id}`)}
        />
      )}
    </div>
  )
}
