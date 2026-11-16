// src/pages/DashboardPage.jsx — tableau de bord (blocs 12 et 21)
// Compteurs réels (GET /api/dashboard), prochaines échéances et activité récente (GET /api/meetings).
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { formatRelative, formatDueDate } from '../utils/dates'
import { MEETING_STATUS, PRIORITY, labelOf } from '../utils/labels'

const panel = {
  background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)', padding: '1.5rem',
}

function StatCard({ label, value, color, to, hint }) {
  return (
    <Link to={to} title={hint} style={{
      ...panel, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', textDecoration: 'none',
    }}>
      <span style={{ fontSize: '2rem', fontWeight: 700, color: color || 'var(--color-text)', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>{label}</span>
    </Link>
  )
}

function RecentItem({ title, subtitle, dot, to }) {
  return (
    <Link to={to} style={{
      textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.75rem 0', borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{subtitle}</div>
      </div>
    </Link>
  )
}

const Muted = ({ children }) => <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', marginTop: '1rem' }}>{children}</p>

export default function DashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/meetings')])
      .then(([s, m]) => {
        setSummary(s)
        setMeetings(m.meetings ?? [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const v = (key) => (loading || !summary ? '…' : summary[key])
  const stats = [
    { label: 'Mes tâches ouvertes', key: 'my_open_tasks', color: 'var(--color-ai)', to: '/tasks' },
    {
      label: 'Mes tâches en retard', key: 'my_overdue_tasks', to: '/tasks',
      color: summary?.my_overdue_tasks ? 'var(--color-danger)' : 'var(--color-success)',
      hint: `Dans tous vos projets : ${summary?.project_overdue_tasks ?? '…'} tâche(s) en retard`,
    },
    {
      label: 'Alertes ouvertes', key: 'open_alerts', to: '/decisions',
      color: summary?.open_alerts ? 'var(--color-amber)' : 'var(--color-success)',
      hint: 'Contradictions non résolues dans vos projets',
    },
    { label: 'Réunions ce mois', key: 'meetings_this_month', color: '#4D96FF', to: '/meetings' },
    { label: 'Projets actifs', key: 'active_projects', color: '#FFD93D', to: '/projects' },
  ]

  const recent = meetings.slice(0, 5).map((m) => ({
    id: m.id,
    to: `/meetings/${m.id}`,
    title: m.title,
    subtitle: `${m.project_name ?? 'Projet'} · ${labelOf(MEETING_STATUS, m.status).label} · ${formatRelative(m.created_at)}`,
    dot: labelOf(MEETING_STATUS, m.status).color,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
          Bonjour{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          Voici où en sont vos projets.
          {summary?.meetings_processing > 0 && ` ${summary.meetings_processing} réunion(s) en cours de traitement.`}
        </p>
      </div>

      {error && <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '13px', margin: 0 }}>Impossible de charger le tableau de bord : {error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
        {stats.map((s) => <StatCard key={s.key} label={s.label} value={v(s.key)} color={s.color} to={s.to} hint={s.hint} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', alignItems: 'start' }}>
        <section style={panel} aria-labelledby="upcoming-title">
          <h2 id="upcoming-title" style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Mes prochaines échéances</h2>
          {loading && <Muted>Chargement…</Muted>}
          {!loading && !error && summary?.upcoming_tasks.length === 0 && <Muted>Aucune tâche à venir ne vous est assignée.</Muted>}
          {summary?.upcoming_tasks.map((t) => (
            <Link key={t.id} to={t.meeting_id ? `/meetings/${t.meeting_id}` : '/tasks'} style={{
              display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.7rem 0',
              borderBottom: '1px solid var(--color-border)', textDecoration: 'none',
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>{t.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                  {t.project_name ?? 'Sans projet'} · <span style={{ color: labelOf(PRIORITY, t.priority).color }}>{labelOf(PRIORITY, t.priority).label}</span>
                </div>
              </div>
              <div style={{ fontSize: '12px', textAlign: 'right', whiteSpace: 'nowrap', color: t.overdue ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                {formatDueDate(t.due_date)}{t.due_estimated ? ' (estimée)' : ''}
                {t.overdue && <div style={{ fontWeight: 600 }}>En retard</div>}
              </div>
            </Link>
          ))}
        </section>

        <section style={panel} aria-labelledby="recent-title">
          <h2 id="recent-title" style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>Activité récente</h2>
          {loading && <Muted>Chargement…</Muted>}
          {!loading && !error && recent.length === 0 && <Muted>Aucune réunion pour l'instant.</Muted>}
          {recent.map((r) => <RecentItem key={r.id} {...r} />)}
        </section>
      </div>
    </div>
  )
}
