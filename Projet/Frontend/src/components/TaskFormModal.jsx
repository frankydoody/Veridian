// src/components/TaskFormModal.jsx — formulaire « Créer / modifier une tâche » (bloc 13)
// L'acteur est choisi parmi les MEMBRES du projet (GET /api/projects/:id/members) ;
// le serveur refuse de toute façon un acteur extérieur (400).
//   task      : tâche à modifier, ou null pour une création
//   defaults  : { projectId, meetingId } pour une création depuis un projet ou une réunion
import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'
import { Field, FormError, Button, FormActions, inputStyle } from './form.jsx'
import { api } from '../services/api.js'
import { validateTask, hasErrors } from '../utils/validation.js'
import { toDateInputValue } from '../utils/dates.js'
import { PRIORITY, TASK_STATUS } from '../utils/labels.js'

export default function TaskFormModal({ task = null, defaults = {}, onClose, onSaved, onDeleted }) {
  const editing = Boolean(task)
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'moyenne',
    status: task?.status ?? 'todo',
    projectId: task?.project_id ?? defaults.projectId ?? '',
    assigneeId: task?.assignee_id ?? '',
    dueDate: toDateInputValue(task?.due_date),
  })
  const [projects, setProjects] = useState([])
  const [members, setMembers] = useState([])
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  useEffect(() => {
    api.get('/projects')
      .then((data) => setProjects(data.projects ?? []))
      .catch((err) => setServerError(`Impossible de charger les projets : ${err.message}`))
  }, [])

  // Membres du projet choisi : la liste des acteurs possibles
  useEffect(() => {
    if (!form.projectId) { setMembers([]); return }
    let cancelled = false
    api.get(`/projects/${form.projectId}/members`)
      .then((data) => { if (!cancelled) setMembers(data.members ?? []) })
      .catch((err) => { if (!cancelled) setServerError(`Impossible de charger les membres : ${err.message}`) })
    return () => { cancelled = true }
  }, [form.projectId])

  function changeProject(e) {
    // Un acteur n'est valable que dans son projet : on le retire si le projet change
    setForm((f) => ({ ...f, projectId: e.target.value, assigneeId: '' }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = validateTask(form)
    setErrors(found)
    if (hasErrors(found)) return

    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      status: form.status,
      assignee_id: form.assigneeId || null,
      due_date: form.dueDate || null,
    }
    setSaving(true)
    setServerError('')
    try {
      const data = editing
        ? await api.put(`/tasks/${task.id}`, body)
        : await api.post('/tasks', {
          ...body,
          project_id: form.projectId || null,
          meeting_id: defaults.meetingId || null,
        })
      onSaved(data.task)
    } catch (err) {
      setServerError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Supprimer la tâche « ${task.title} » ?`)) return
    setSaving(true)
    setServerError('')
    try {
      await api.delete(`/tasks/${task.id}`)
      onDeleted?.(task)
    } catch (err) {
      setServerError(err.message)
      setSaving(false)
    }
  }

  // L'ancien acteur reste affiché s'il n'est plus membre, pour ne pas l'effacer en silence
  const assigneeMissing = form.assigneeId && !members.some((m) => m.id === form.assigneeId)

  return (
    <Modal title={editing ? 'Modifier la tâche' : 'Nouvelle tâche'} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <FormError message={serverError} />

        <Field id="task-title" label="Titre *" error={errors.title}>
          <input id="task-title" style={inputStyle} value={form.title} onChange={set('title')} maxLength={200}
            aria-invalid={Boolean(errors.title)} />
        </Field>

        <Field id="task-description" label="Description" error={errors.description}>
          <textarea id="task-description" style={{ ...inputStyle, minHeight: '70px', resize: 'vertical' }}
            value={form.description} onChange={set('description')} maxLength={2000} />
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0 0.75rem' }}>
          <Field id="task-priority" label="Priorité">
            <select id="task-priority" style={inputStyle} value={form.priority} onChange={set('priority')}>
              {Object.entries(PRIORITY).map(([key, p]) => <option key={key} value={key}>{p.label}</option>)}
            </select>
          </Field>
          <Field id="task-status" label="Statut">
            <select id="task-status" style={inputStyle} value={form.status} onChange={set('status')}>
              {Object.entries(TASK_STATUS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
            </select>
          </Field>
          <Field id="task-project" label="Projet"
            hint={editing ? 'Le projet d\'une tâche existante ne change pas.' : undefined}>
            <select id="task-project" style={inputStyle} value={form.projectId} onChange={changeProject}
              disabled={editing || Boolean(defaults.meetingId)}>
              <option value="">— Aucun projet —</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field id="task-assignee" label="Acteur (membre du projet)" error={errors.assigneeId}
            hint={!form.projectId ? 'Choisissez un projet pour voir ses membres.' : undefined}>
            <select id="task-assignee" style={inputStyle} value={form.assigneeId} onChange={set('assigneeId')}
              disabled={!form.projectId}>
              <option value="">— Personne —</option>
              {assigneeMissing && <option value={form.assigneeId}>{task?.assignee ?? 'Ancien membre'} (plus membre)</option>}
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field id="task-due" label="Échéance" error={errors.dueDate}
            hint={task?.due_estimated ? 'Date estimée par l\'analyse : la modifier la rend définitive.' : undefined}>
            <input id="task-due" type="date" style={inputStyle} value={form.dueDate} onChange={set('dueDate')} />
          </Field>
        </div>

        <FormActions>
          {editing && (
            <Button type="button" variant="danger" onClick={handleDelete} disabled={saving} style={{ marginRight: 'auto' }}>
              Supprimer
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer la tâche'}
          </Button>
        </FormActions>
      </form>
    </Modal>
  )
}
