// src/pages/DashboardPage.jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import { formatRelative } from '../utils/dates'
import { MEETING_STATUS, labelOf } from '../utils/labels'

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <span style={{
        fontSize: '2rem',
        fontWeight: '700',
        color: color || 'var(--color-text-1)',
        lineHeight: 1,
      }}>
        {value}
      </span>
      <span style={{ fontSize: '13px', color: 'var(--color-text-2)' }}>
        {label}
      </span>
    </div>
  )
}

// ─── RecentItem ───────────────────────────────────────────────────────────────
function RecentItem({ title, subtitle, dot, to }) {
  return (
    <Link to={to} style={{
      textDecoration: 'none',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{
        width: '8px', height: '8px',
        borderRadius: '50%',
        background: dot || 'var(--color-ai)',
        flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text-1)' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-2)' }}>
          {subtitle}
        </div>
      </div>
    </Link>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const [projects, setProjects]   = useState([])
  const [meetings, setMeetings]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    async function fetchAll() {
      try {
        // Deux appels en parallèle
        const [projData, meetData] = await Promise.all([
          api.get('/projects'),
          api.get('/meetings'),
        ])
        setProjects(projData.projects ?? [])
        setMeetings(meetData.meetings ?? [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  // Stats calculées depuis les vraies données
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  const meetingsThisMonth = meetings.filter(
    m => new Date(m.created_at) >= startOfMonth
  ).length

  const activeProjects = projects.filter(p => p.status === 'active').length

  const stats = [
    { label: 'Réunions ce mois', value: loading ? '…' : meetingsThisMonth, color: 'var(--color-ai)' },
    { label: 'Réunions totales', value: loading ? '…' : meetings.length,   color: '#6BCB77' },
    { label: 'Projets actifs',   value: loading ? '…' : activeProjects,    color: '#4D96FF' },
    { label: 'Projets totaux',   value: loading ? '…' : projects.length,   color: '#FFD93D' },
  ]

  // Activité récente = 5 dernières réunions
  const recent = meetings.slice(0, 5).map(m => ({
    id: m.id,
    to: '/meetings',
    title: m.title,
    subtitle: `${m.project_name ?? 'Projet'} · ${labelOf(MEETING_STATUS, m.status).label} · ${formatRelative(m.created_at)}`,
    dot: labelOf(MEETING_STATUS, m.status).color,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* En-tête */}
      <div>
        <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text-1)' }}>
          Bonjour{user?.name ? `, ${user.name.split(' ')[0]}` : ''} 👋
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '0.25rem' }}>
          Voici un résumé de l'activité de ton organisation.
        </p>
      </div>

      {/* Grille stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
      }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Activité récente */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
      }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text-1)', marginBottom: '0.25rem' }}>
          Activité récente
        </h2>

        {loading && (
          <p style={{ color: 'var(--color-text-2)', fontSize: '13px', marginTop: '1rem' }}>
            Chargement…
          </p>
        )}

        {!loading && error && (
          <p role="alert" style={{ color: 'var(--color-danger)', fontSize: '13px', marginTop: '1rem' }}>
            Impossible de charger le tableau de bord : {error}
          </p>
        )}

        {!loading && !error && recent.length === 0 && (
          <p style={{ color: 'var(--color-text-2)', fontSize: '13px', marginTop: '1rem' }}>
            Aucune activité récente.
          </p>
        )}

        {!loading && !error && recent.map((r) => (
          <RecentItem key={r.id} {...r} />
        ))}
      </div>

    </div>
  )
}
