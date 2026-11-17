// src/pages/TasksPage.jsx — « Mes tâches » (bloc 21)
// Tâches qui me sont assignées et celles de mes projets (GET /api/tasks), filtres (statut,
// projet, acteur), tri par échéance, indicateur « en retard », changement de statut,
// création et modification (formulaire du bloc 13).
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import TaskFormModal from '../components/TaskFormModal.jsx'
import { formatDueDate, isOverdue } from '../utils/dates.js'
import { PRIORITY, TASK_STATUS, labelOf } from '../utils/labels.js'
import { filterTasks, sortByDueDate, actorsOf, projectsOf } from '../utils/tasks.js'

const selectStyle = {
  padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)',
  background: 'var(--color-surface-1)', color: 'var(--color-text)', fontSize: '13px',
}

const STATUS_FILTERS = [
  { key: 'open', label: 'À faire et en cours' },
  { key: 'overdue', label: 'En retard' },
  { key: 'todo', label: 'À faire' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'done', label: 'Terminées' },
  { key: 'all', label: 'Toutes' },
]

const COLUMNS = 'minmax(160px, 2fr) minmax(80px, 1fr) minmax(80px, 1fr) minmax(90px, 1fr) 72px 112px'

function TaskRow({ task, onStatus, onEdit, busy }) {
  const late = isOverdue(task)
  const priority = labelOf(PRIORITY, task.priority)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: COLUMNS, gap: '0.75rem', alignItems: 'center',
      padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)',
      opacity: task.status === 'done' ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
        <button onClick={() => onEdit(task)} title="Modifier la tâche" style={{
          background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer',
          fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'inherit',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
        }}>
          {task.title}
        </button>
        {task.meeting_id && (
          <Link to={`/meetings/${task.meeting_id}`} style={{ fontSize: '11px', color: 'var(--color-text-faint)', width: 'fit-content' }}>
            Réunion : {task.meeting_title}
          </Link>
        )}
      </div>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{task.assignee ?? '—'}</span>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{task.project_name ?? '—'}</span>
      <span style={{ fontSize: '12px', color: late ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
        {task.due_date ? formatDueDate(task.due_date) : '—'}
        {task.due_date && task.due_estimated && <span title="Date estimée par l'analyse"> (estimée)</span>}
        {late && <strong style={{ display: 'block', fontSize: '11px' }}>En retard</strong>}
      </span>
      <span style={{
        fontSize: '11px', fontWeight: 500, color: priority.color, background: priority.bg,
        borderRadius: '999px', padding: '2px 10px', width: 'fit-content',
      }}>
        {priority.label}
      </span>
      <select
        aria-label={`Statut de « ${task.title} »`}
        value={task.status}
        onChange={(e) => onStatus(task, e.target.value)}
        disabled={busy}
        style={{ ...selectStyle, padding: '0.3rem 0.4rem', fontSize: '12px', color: labelOf(TASK_STATUS, task.status).color }}
      >
        {Object.entries(TASK_STATUS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
      </select>
    </div>
  )
}

export default function TasksPage() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [filters, setFilters] = useState({ status: 'open', projectId: '', assignee: 'me' })
  const [editing, setEditing] = useState(null) // null | { task: null } | { task }

  useEffect(() => {
    api.get('/tasks')
      .then((data) => setTasks(data.tasks ?? []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const actors = useMemo(() => actorsOf(tasks), [tasks])
  const projects = useMemo(() => projectsOf(tasks), [tasks])
  const shown = useMemo(
    () => sortByDueDate(filterTasks(tasks, filters, user?.id)),
    [tasks, filters, user?.id]
  )
  const myOverdue = useMemo(
    () => tasks.filter((t) => t.assignee_id === user?.id && isOverdue(t)).length,
    [tasks, user?.id]
  )

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))

  async function changeStatus(task, status) {
    setBusyId(task.id)
    setActionError('')
    try {
      const data = await api.patch(`/tasks/${task.id}/status`, { status })
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)))
    } catch (err) {
      setActionError(`Statut non modifié : ${err.message}`)
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p style={{ color: 'var(--color-text-muted)' }}>Chargement des tâches…</p>
  if (error) return <p role="alert" style={{ color: 'var(--color-danger)' }}>Impossible de charger les tâches : {error}</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Mes tâches</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
            Tâches qui vous sont assignées et celles de vos projets · {tasks.length} au total
            {myOverdue > 0 && <strong style={{ color: 'var(--color-danger)' }}> · {myOverdue} des vôtres en retard</strong>}
          </p>
        </div>
        <button onClick={() => setEditing({ task: null })} style={{
          background: 'var(--color-ai)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
          padding: '0.5rem 1rem', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
        }}>
          + Nouvelle tâche
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Acteur{' '}
          <select value={filters.assignee} onChange={setFilter('assignee')} style={selectStyle}>
            <option value="me">Moi</option>
            <option value="">Tout le monde</option>
            <option value="none">Personne</option>
            {actors.filter((a) => a.id !== user?.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Statut{' '}
          <select value={filters.status} onChange={setFilter('status')} style={selectStyle}>
            {STATUS_FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </label>
        <label style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Projet{' '}
          <select value={filters.projectId} onChange={setFilter('projectId')} style={selectStyle}>
            <option value="">Tous</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <span style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginLeft: 'auto' }}>
          {shown.length} tâche{shown.length > 1 ? 's' : ''} · triées par échéance
        </span>
      </div>

      {actionError && (
        <div role="alert" style={{ padding: '0.6rem 0.9rem', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-muted)', color: 'var(--color-danger)', fontSize: '13px' }}>
          {actionError}
        </div>
      )}

      <div style={{
        background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', overflowX: 'auto',
      }}>
        <div style={{ minWidth: '650px' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: COLUMNS, gap: '0.75rem', padding: '0.625rem 1rem',
            background: 'var(--color-surface-2)', borderBottom: '1px solid var(--color-border)',
          }}>
            {['Tâche', 'Acteur', 'Projet', 'Échéance', 'Priorité', 'Statut'].map((h) => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </span>
            ))}
          </div>

          {shown.map((t) => (
            <TaskRow key={t.id} task={t} busy={busyId === t.id} onStatus={changeStatus} onEdit={(task) => setEditing({ task })} />
          ))}

          {shown.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              {tasks.length === 0
                ? 'Aucune tâche pour l\'instant. Elles apparaissent après l\'analyse d\'une réunion, ou avec « + Nouvelle tâche ».'
                : 'Aucune tâche ne correspond à ces filtres.'}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <TaskFormModal
          task={editing.task}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setTasks((prev) => (editing.task ? prev.map((t) => (t.id === saved.id ? saved : t)) : [saved, ...prev]))
            setEditing(null)
          }}
          onDeleted={(deleted) => {
            setTasks((prev) => prev.filter((t) => t.id !== deleted.id))
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}
