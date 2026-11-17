// src/utils/tasks.js
// Filtres, tri et regroupement des tâches (bloc 21). Fonctions pures : testées avec node --test.
import { isOverdue } from './dates.js'

const PRIORITY_RANK = { haute: 1, moyenne: 2, basse: 3 }
export const NEXT_STATUS = { todo: 'in_progress', in_progress: 'done', done: 'todo' }

/**
 * @param filters { status: 'all'|'open'|'todo'|'in_progress'|'done'|'overdue',
 *                  projectId: ''|id, assignee: ''|'me'|'none'|userId }
 */
export function filterTasks(tasks, filters, currentUserId, now = Date.now()) {
  const { status = 'all', projectId = '', assignee = '' } = filters
  return tasks.filter((t) => {
    if (status === 'open' && t.status === 'done') return false
    if (status === 'overdue' && !isOverdue(t, now)) return false
    if (['todo', 'in_progress', 'done'].includes(status) && t.status !== status) return false
    if (projectId && t.project_id !== projectId) return false
    if (assignee === 'me' && t.assignee_id !== currentUserId) return false
    if (assignee === 'none' && t.assignee_id) return false
    if (assignee && !['me', 'none'].includes(assignee) && t.assignee_id !== assignee) return false
    return true
  })
}

/**
 * Tri par échéance : la plus proche d'abord, sans échéance à la fin ; à égalité, priorité.
 * Les tâches terminées passent après les autres.
 */
export function sortByDueDate(tasks) {
  return [...tasks].sort((a, b) => {
    const doneA = a.status === 'done' ? 1 : 0
    const doneB = b.status === 'done' ? 1 : 0
    if (doneA !== doneB) return doneA - doneB
    const da = a.due_date ? Date.parse(a.due_date) : Infinity
    const db = b.due_date ? Date.parse(b.due_date) : Infinity
    if (da !== db) return da - db
    return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
  })
}

// Acteurs présents dans une liste de tâches : [{ id, name }], triés par nom
export function actorsOf(tasks) {
  const map = new Map()
  for (const t of tasks) if (t.assignee_id) map.set(t.assignee_id, t.assignee ?? 'Sans nom')
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

// Projets présents dans une liste de tâches : [{ id, name }], triés par nom
export function projectsOf(tasks) {
  const map = new Map()
  for (const t of tasks) if (t.project_id) map.set(t.project_id, t.project_name ?? 'Projet')
  return [...map].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * Regroupe par acteur (page d'une réunion) : [{ key, name, linked, tasks }].
 * Un nom cité mais sans compte (« linked: false ») forme son propre groupe ; les tâches sans
 * acteur sont à la fin. Chaque groupe est trié par échéance.
 */
export function groupByActor(tasks) {
  const groups = new Map()
  for (const t of tasks) {
    const key = t.assignee_id ?? (t.assignee ? `nom:${t.assignee}` : 'aucun')
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        name: t.assignee ?? 'Sans acteur',
        linked: Boolean(t.assignee_id),
        tasks: [],
      })
    }
    groups.get(key).tasks.push(t)
  }
  return [...groups.values()]
    .map((g) => ({ ...g, tasks: sortByDueDate(g.tasks) }))
    .sort((a, b) => {
      if (a.key === 'aucun') return 1
      if (b.key === 'aucun') return -1
      return a.name.localeCompare(b.name, 'fr')
    })
}
