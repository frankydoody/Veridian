import { useState, useEffect } from 'react'
import { api } from '../services/api'

const STATUS_LABELS = {
  active: 'Actif',
  archived: 'Archivé',
  inactive: 'Inactif',
}

const STATUS_COLORS = {
  active:   { bg: 'var(--color-success-muted)', color: 'var(--color-success)' },
  archived: { bg: 'var(--color-surface-3)',     color: 'var(--color-text-2)'  },
  inactive: { bg: 'var(--color-surface-3)',     color: 'var(--color-text-2)'  },
}

const PROJECT_COLORS = [
  '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16',
]

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    year: 'numeric', month: 'short', day: 'numeric',
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

function ProjectCard({ project, color }) {
  return (
    <div style={{
      background: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderTop: `3px solid ${color}`,
      borderRadius: '12px',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      cursor: 'pointer',
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-1)' }}>
          {project.name}
        </h3>
        <StatusBadge status={project.status} />
      </div>

      {project.description && (
        <p style={{
          margin: 0,
          fontSize: '0.85rem',
          color: 'var(--color-text-2)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {project.description}
        </p>
      )}

      <div style={{
        display: 'flex',
        gap: '1rem',
        fontSize: '0.8rem',
        color: 'var(--color-text-2)',
        borderTop: '1px solid var(--color-border)',
        paddingTop: '0.75rem',
        marginTop: 'auto',
      }}>
        <span>Créé le {formatDate(project.created_at)}</span>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await api.get('/projects')
        setProjects(data.projects ?? [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProjects()
  }, [])

  const filtered = filter === 'all'
    ? projects
    : projects.filter(p => p.status === filter)

  const filters = [
    { key: 'all',      label: 'Tous' },
    { key: 'active',   label: 'Actifs' },
    { key: 'archived', label: 'Archivés' },
    { key: 'inactive', label: 'Inactifs' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
            Projets
          </h1>
          <p style={{ color: 'var(--color-text-2)', margin: '4px 0 0', fontSize: '0.9rem' }}>
            {loading ? '...' : `${projects.length} projet${projects.length !== 1 ? 's' : ''} au total`}
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
          + Nouveau projet
        </button>
      </div>

      {/* Filtres */}
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

      {/* États */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-2)' }}>
          Chargement des projets…
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
          Aucun projet trouvé.
        </div>
      )}

      {/* Grille de cartes */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {filtered.map((project, i) => (
            <ProjectCard
              key={project.id}
              project={project}
              color={PROJECT_COLORS[i % PROJECT_COLORS.length]}
            />
          ))}
        </div>
      )}
    </div>
  )
}
