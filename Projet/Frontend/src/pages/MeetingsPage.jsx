import { useState, useEffect } from 'react'
import { api } from '../services/api'

const STATUS_LABELS = {
  completed: 'terminée',
  in_progress: 'en cours',
  planned: 'planifiée',
}

const STATUS_COLORS = {
  completed: { bg: 'var(--color-success-muted)', color: 'var(--color-success)' },
  in_progress: { bg: 'var(--color-ai-muted)', color: 'var(--color-ai)' },
  planned: { bg: 'var(--color-surface-3)', color: 'var(--color-text-2)' },
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] ?? status
  const style = STATUS_COLORS[status] ?? {}
  return (
    <span style={{
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: style.bg,
      color: style.color,
    }}>
      {label}
    </span>
  )
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function fetchMeetings() {
      try {
        const data = await api.get('/meetings')
        setMeetings(data.meetings ?? [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchMeetings()
  }, [])

  const filtered = filter === 'all'
    ? meetings
    : meetings.filter(m => m.status === filter)

  const filters = [
    { key: 'all', label: 'Toutes' },
    { key: 'in_progress', label: 'En cours' },
    { key: 'planned', label: 'Planifiées' },
    { key: 'completed', label: 'Terminées' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
            Réunions
          </h1>
          <p style={{ color: 'var(--color-text-2)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            {loading ? '...' : `${meetings.length} réunion${meetings.length !== 1 ? 's' : ''} au total`}
          </p>
        </div>
        <button style={{
          padding: '8px 18px',
          background: 'var(--color-ai)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontWeight: 600,
          cursor: 'pointer',
          fontSize: '0.9rem',
        }}>
          + Nouvelle réunion
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 16px',
              borderRadius: '999px',
              border: '1.5px solid',
              borderColor: filter === f.key ? 'var(--color-ai)' : 'var(--color-border)',
              background: filter === f.key ? 'var(--color-ai-muted)' : 'transparent',
              color: filter === f.key ? 'var(--color-ai)' : 'var(--color-text-2)',
              fontWeight: filter === f.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-2)' }}>
          Chargement des réunions…
        </div>
      )}

      {error && (
        <div style={{
          padding: '1rem 1.25rem',
          background: 'var(--color-danger-muted, #fee2e2)',
          color: 'var(--color-danger, #dc2626)',
          borderRadius: '10px',
          fontWeight: 500,
        }}>
          Erreur : {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-2)' }}>
          Aucune réunion trouvée.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          overflow: 'hidden',
        }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 1.5fr',
            padding: '10px 20px',
            borderBottom: '1px solid var(--color-border)',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-2)',
          }}>
            <span>Titre</span>
            <span>Projet</span>
            <span>Statut</span>
            <span>Début</span>
            <span>Fin</span>
          </div>

          {/* Rows */}
          {filtered.map((m, i) => (
            <div
              key={m.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.5fr 1fr 1.5fr 1.5fr',
                padding: '14px 20px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface-2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontWeight: 600, color: 'var(--color-text-1)', fontSize: '0.9rem' }}>
                {m.title}
              </span>
              <span style={{ color: 'var(--color-text-2)', fontSize: '0.85rem' }}>
                {m.project_name ?? '—'}
              </span>
              <StatusBadge status={m.status} />
              <span style={{ color: 'var(--color-text-2)', fontSize: '0.82rem' }}>
                {formatDate(m.started_at)}
              </span>
              <span style={{ color: 'var(--color-text-2)', fontSize: '0.82rem' }}>
                {formatDate(m.ended_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
