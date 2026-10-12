// src/pages/TasksPage.jsx
// Liste des tâches — données réelles depuis GET /api/tasks

import { useState, useEffect } from 'react'
import { api } from '../services/api.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Convertit le statut DB → label filtre
function statusToFilter(status) {
  if (status === 'done')       return 'terminées'
  if (status === 'in_progress') return 'en cours'
  return 'en cours'  // todo → "en cours" (pas encore commencé)
}

const PRIORITY_STYLE = {
  haute:   { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
  moyenne: { color: '#FFD93D', bg: 'rgba(255,217,61,0.12)'  },
  basse:   { color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
}

// ─── Composant TaskRow ────────────────────────────────────────────────────────
function TaskRow({ task, onToggle }) {
  const done = task.status === 'done'
  const p    = PRIORITY_STYLE[task.priority] || { color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '32px 1fr 120px 130px 80px',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.875rem 1rem',
      borderBottom: '1px solid var(--color-border)',
      opacity: done ? 0.5 : 1,
      transition: 'opacity 200ms ease',
    }}>

      {/* Checkbox — appelle PATCH /api/tasks/:id/status */}
      <div
        onClick={() => onToggle(task)}
        style={{
          width: '18px', height: '18px',
          borderRadius: '5px',
          border: done ? 'none' : '2px solid var(--color-border)',
          background: done ? 'var(--color-ai)' : 'transparent',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Titre */}
      <span style={{
        fontSize: '13px', fontWeight: '500', color: 'var(--color-text)',
        textDecoration: done ? 'line-through' : 'none',
      }}>
        {task.title}
      </span>

      {/* Assigné */}
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {task.assignee || '—'}
      </span>

      {/* Projet */}
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {task.project_name || '—'}
      </span>

      {/* Badge priorité */}
      <span style={{
        fontSize: '11px', fontWeight: '500',
        color: p.color, background: p.bg,
        borderRadius: '999px', padding: '2px 10px',
        textAlign: 'center', width: 'fit-content',
      }}>
        {task.priority}
      </span>

    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks,   setTasks]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [filter,  setFilter]  = useState('toutes')

  // Chargement initial
  useEffect(() => {
    api.get('/tasks')
      .then((data) => setTasks(data.tasks))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Toggle done ↔ todo via PATCH /api/tasks/:id/status
  async function handleToggle(task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    try {
      const data = await api.patch(`/tasks/${task.id}/status`, { status: newStatus })
      // Remplace la tâche modifiée dans la liste locale
      setTasks((prev) => prev.map((t) => t.id === task.id ? data.task : t))
    } catch (err) {
      console.error('Erreur toggle tâche :', err.message)
    }
  }

  // Filtrage
  const filtered = tasks.filter((t) => {
    if (filter === 'en cours')  return t.status !== 'done'
    if (filter === 'terminées') return t.status === 'done'
    return true
  })

  // ── États de chargement / erreur ────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '14px' }}>
      Chargement des tâches…
    </div>
  )

  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#FF6B6B', fontSize: '14px' }}>
      Erreur : {error}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text)' }}>
            Tâches
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Extraites automatiquement des réunions · {tasks.length} tâche{tasks.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button style={{
          background: 'var(--color-ai)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 1rem',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
        }}>
          + Nouvelle tâche
        </button>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {['toutes', 'en cours', 'terminées'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: '13px', fontWeight: '500',
              cursor: 'pointer',
              background: filter === f ? 'var(--color-ai-glow)' : 'transparent',
              color:      filter === f ? 'var(--color-ai)'      : 'var(--color-text-muted)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* En-tête colonnes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 120px 130px 80px',
          gap: '1rem',
          padding: '0.625rem 1rem',
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span />
          {['Tâche', 'Assigné', 'Projet', 'Priorité'].map((h) => (
            <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Lignes */}
        {filtered.map((t) => (
          <TaskRow key={t.id} task={t} onToggle={handleToggle} />
        ))}

        {/* Vide */}
        {filtered.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            {tasks.length === 0
              ? 'Aucune tâche pour l\'instant. Les tâches seront extraites automatiquement lors des réunions.'
              : 'Aucune tâche dans cette catégorie.'}
          </div>
        )}
      </div>

    </div>
  )
}
