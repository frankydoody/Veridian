// src/pages/DecisionsPage.jsx
// Bloc 15 : vue agrégée des décisions d'un projet et alertes de contradiction.
// GET /api/decisions/project/:id, GET /api/alerts/project/:id,
// PATCH /api/alerts/:id/resolve, GET /api/projects/:id/export/pdf

import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api.js'
import { getToken } from '../api/client.js'

const DECISION_STATUS = {
  confirmed:    { label: 'Confirmée',  color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  draft:        { label: 'Brouillon',  color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' },
  contradicted: { label: 'Contredite', color: 'var(--color-amber)', bg: 'var(--color-amber-bg)' },
}

const SEVERITY = {
  high:   { label: 'Gravité élevée',  color: '#F87171' },
  medium: { label: 'Gravité moyenne', color: 'var(--color-amber)' },
  low:    { label: 'Gravité faible',  color: 'var(--color-text-muted)' },
}

const card = {
  background: 'var(--color-surface-1)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-lg)',
  padding: '1rem 1.25rem',
}

const selectStyle = {
  padding: '0.4rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-1)',
  color: 'var(--color-text)',
  fontSize: '13px',
  cursor: 'pointer',
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function Badge({ label, color, bg }) {
  return (
    <span style={{
      padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 600,
      color, background: bg ?? 'transparent', border: bg ? 'none' : `1px solid ${color}`,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function AlertCard({ alert, onResolve, busy }) {
  const severity = SEVERITY[alert.severity] ?? SEVERITY.medium
  const resolved = Boolean(alert.resolved_at)

  return (
    <div style={{
      ...card,
      borderLeft: `3px solid ${resolved ? 'var(--color-border)' : severity.color}`,
      opacity: resolved ? 0.65 : 1,
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Badge label={severity.label} color={severity.color} />
          {resolved && <Badge label={`Résolue le ${formatDate(alert.resolved_at)}`} color="var(--color-success)" bg="var(--color-success-bg)" />}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>Détectée le {formatDate(alert.created_at)}</span>
      </div>

      <div style={{ fontSize: '13px', lineHeight: 1.55, color: 'var(--color-text)' }}>
        <div><strong>Nouvelle décision :</strong> {alert.new_decision}</div>
        <div style={{ marginTop: '0.25rem' }}>
          <strong>Contredit :</strong>{' '}
          <span style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>{alert.conflict_decision}</span>
        </div>
      </div>

      {alert.explanation && (
        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{alert.explanation}</p>
      )}

      {!resolved && (
        <div>
          <button
            onClick={() => onResolve(alert.id)}
            disabled={busy}
            style={{
              padding: '0.4rem 0.9rem', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 600,
              border: '1px solid var(--color-border-active)', background: 'var(--color-primary-glow)',
              color: 'var(--color-text)', cursor: busy ? 'wait' : 'pointer',
            }}
          >
            {busy ? 'Résolution…' : 'Marquer comme résolue'}
          </button>
        </div>
      )}
    </div>
  )
}

function DecisionRow({ decision }) {
  const status = DECISION_STATUS[decision.status] ?? DECISION_STATUS.draft
  const contradicted = decision.status === 'contradicted'

  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
        <div style={{
          fontSize: '14px', fontWeight: 600, lineHeight: 1.5, color: contradicted ? 'var(--color-text-muted)' : 'var(--color-text)',
          textDecoration: contradicted ? 'line-through' : 'none',
        }}>
          {decision.content}
        </div>
        <Badge label={status.label} color={status.color} bg={status.bg} />
      </div>
      {decision.context && (
        <p style={{ margin: 0, fontSize: '12px', lineHeight: 1.55, color: 'var(--color-text-muted)' }}>{decision.context}</p>
      )}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '11px', color: 'var(--color-text-faint)' }}>
        <span>Réunion : {decision.meeting_title}</span>
        {decision.responsible && <span>Responsable : {decision.responsible}</span>}
        <span>Confiance : {decision.confidence}%</span>
        <span>{formatDate(decision.created_at)}</span>
      </div>
    </div>
  )
}

export default function DecisionsPage() {
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [decisions, setDecisions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [onlyOpen, setOnlyOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [resolvingId, setResolvingId] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Projets (le premier est sélectionné d'office)
  useEffect(() => {
    api.get('/projects')
      .then((data) => {
        const actifs = (data.projects ?? []).filter((p) => p.status === 'active')
        setProjects(actifs)
        if (actifs.length > 0) setProjectId(actifs[0].id)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const load = useCallback(async (id) => {
    setError('')
    setLoading(true)
    try {
      const [d, a] = await Promise.all([
        api.get(`/decisions/project/${id}`),
        api.get(`/alerts/project/${id}`),
      ])
      setDecisions(d.decisions ?? [])
      setAlerts(a.alerts ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (projectId) load(projectId)
  }, [projectId, load])

  async function handleResolve(alertId) {
    setResolvingId(alertId)
    try {
      const data = await api.patch(`/alerts/${alertId}/resolve`)
      const resolvedAt = data?.alert?.resolved_at ?? new Date().toISOString()
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? { ...a, resolved_at: resolvedAt } : a)))
    } catch (err) {
      setError(err.message)
    } finally {
      setResolvingId(null)
    }
  }

  // Le PDF demande le jeton : on télécharge en mémoire puis on déclenche l'enregistrement
  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/export/pdf`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || "L'export a échoué")
      }
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'rapport-veridian.pdf'
      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = name
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setExporting(false)
    }
  }

  const openAlerts = alerts.filter((a) => !a.resolved_at)
  const shownAlerts = onlyOpen ? openAlerts : alerts
  const shownDecisions = statusFilter === 'all' ? decisions : decisions.filter((d) => d.status === statusFilter)

  const filters = [
    { key: 'all', label: 'Toutes' },
    { key: 'confirmed', label: 'Confirmées' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'contradicted', label: 'Contredites' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>Décisions et contradictions</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
            {projectId
              ? `${decisions.length} décision${decisions.length > 1 ? 's' : ''} · ${openAlerts.length} alerte${openAlerts.length > 1 ? 's' : ''} ouverte${openAlerts.length > 1 ? 's' : ''}`
              : 'Choisis un projet pour voir ses décisions'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select aria-label="Projet" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={selectStyle}>
            {projects.length === 0 && <option value="">Aucun projet</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button
            onClick={handleExport}
            disabled={!projectId || exporting}
            style={{
              ...selectStyle, fontWeight: 600,
              background: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none',
              opacity: !projectId || exporting ? 0.6 : 1,
            }}
          >
            {exporting ? 'Export en cours…' : 'Exporter en PDF'}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ ...card, borderColor: 'var(--color-border-amber)', background: 'var(--color-amber-bg)', color: 'var(--color-amber-text)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>Chargement…</p>
      ) : (
        <>
          {/* Alertes */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>
                Alertes de contradiction
              </h2>
              <label style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', gap: '0.4rem', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
                Seulement les alertes ouvertes
              </label>
            </div>
            {shownAlerts.length === 0 ? (
              <div style={{ ...card, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                {alerts.length === 0
                  ? 'Aucune contradiction détectée dans ce projet.'
                  : 'Toutes les alertes sont résolues.'}
              </div>
            ) : (
              shownAlerts.map((a) => (
                <AlertCard key={a.id} alert={a} onResolve={handleResolve} busy={resolvingId === a.id} />
              ))
            )}
          </section>

          {/* Décisions */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>Décisions du projet</h2>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {filters.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    aria-pressed={statusFilter === f.key}
                    style={{
                      padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '12px', cursor: 'pointer',
                      border: '1px solid var(--color-border)',
                      background: statusFilter === f.key ? 'var(--color-primary-glow)' : 'transparent',
                      color: statusFilter === f.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {shownDecisions.length === 0 ? (
              <div style={{ ...card, fontSize: '13px', color: 'var(--color-text-muted)' }}>
                Aucune décision à afficher. Elles apparaissent après l'extraction depuis une réunion transcrite.
              </div>
            ) : (
              shownDecisions.map((d) => <DecisionRow key={d.id} decision={d} />)
            )}
          </section>
        </>
      )}
    </div>
  )
}
