import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterTasks, sortByDueDate, actorsOf, projectsOf, groupByActor, NEXT_STATUS } from './tasks.js'

const NOW = Date.parse('2026-11-16T12:00:00Z')
const tasks = [
  { id: 1, title: 'Retard', status: 'todo', priority: 'basse', due_date: '2026-11-10T17:00:00Z', project_id: 'p1', project_name: 'Atlas', assignee_id: 'moi', assignee: 'Moi' },
  { id: 2, title: 'Bientôt', status: 'in_progress', priority: 'haute', due_date: '2026-11-20T17:00:00Z', project_id: 'p2', project_name: 'Portail', assignee_id: 'marie', assignee: 'Marie' },
  { id: 3, title: 'Sans date', status: 'todo', priority: 'haute', due_date: null, project_id: 'p1', project_name: 'Atlas', assignee_id: null, assignee: null },
  { id: 4, title: 'Fini', status: 'done', priority: 'haute', due_date: '2026-11-01T17:00:00Z', project_id: 'p1', project_name: 'Atlas', assignee_id: 'moi', assignee: 'Moi' },
  { id: 5, title: 'Même date', status: 'todo', priority: 'haute', due_date: '2026-11-20T17:00:00Z', project_id: 'p2', project_name: 'Portail', assignee: 'Pierre (client)' },
]
const ids = (list) => list.map((t) => t.id)

test('filterTasks : statut, en retard, projet, acteur (moi, personne, quelqu\'un)', () => {
  assert.deepEqual(ids(filterTasks(tasks, { status: 'open' }, 'moi', NOW)), [1, 2, 3, 5])
  assert.deepEqual(ids(filterTasks(tasks, { status: 'done' }, 'moi', NOW)), [4])
  assert.deepEqual(ids(filterTasks(tasks, { status: 'overdue' }, 'moi', NOW)), [1]) // la terminée n'est pas en retard
  assert.deepEqual(ids(filterTasks(tasks, { projectId: 'p2' }, 'moi', NOW)), [2, 5])
  assert.deepEqual(ids(filterTasks(tasks, { assignee: 'me' }, 'moi', NOW)), [1, 4])
  assert.deepEqual(ids(filterTasks(tasks, { assignee: 'none' }, 'moi', NOW)), [3, 5])
  assert.deepEqual(ids(filterTasks(tasks, { assignee: 'marie', status: 'open' }, 'moi', NOW)), [2])
})

test('sortByDueDate : échéance la plus proche, puis priorité ; sans date et terminées à la fin', () => {
  assert.deepEqual(ids(sortByDueDate(tasks)), [1, 2, 5, 3, 4])
})

test('actorsOf et projectsOf : listes pour les filtres', () => {
  assert.deepEqual(actorsOf(tasks), [{ id: 'marie', name: 'Marie' }, { id: 'moi', name: 'Moi' }])
  assert.deepEqual(projectsOf(tasks).map((p) => p.name), ['Atlas', 'Portail'])
})

test('groupByActor : un groupe par acteur, nom non lié à part, sans acteur à la fin', () => {
  const groups = groupByActor(tasks)
  assert.deepEqual(groups.map((g) => [g.name, g.linked, ids(g.tasks)]), [
    ['Marie', true, [2]],
    ['Moi', true, [1, 4]],
    ['Pierre (client)', false, [5]],
    ['Sans acteur', false, [3]],
  ])
})

test('NEXT_STATUS : à faire → en cours → terminée → à faire', () => {
  assert.equal(NEXT_STATUS.todo, 'in_progress')
  assert.equal(NEXT_STATUS.in_progress, 'done')
  assert.equal(NEXT_STATUS.done, 'todo')
})
