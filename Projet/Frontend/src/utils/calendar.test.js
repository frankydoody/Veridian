import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  toDayKey, utcDayKey, addDays, shiftMonth, shiftMonthKeepDay, parseMonthParam, toMonthParam,
  buildMonthGrid, gridRange, groupEvents, eventKind, eventLink, moveFocus, monthLabel, dayLabel,
} from './calendar.js'

test('buildMonthGrid : 42 cases, commence un lundi, contient tout le mois', () => {
  // Décembre 2026 commence un mardi : la grille commence le lundi 30 novembre
  const grid = buildMonthGrid({ year: 2026, month: 11 })
  assert.equal(grid.length, 42)
  assert.equal(grid[0].key, '2026-11-30')
  assert.equal(grid[0].inMonth, false)
  assert.equal(grid[1].key, '2026-12-01')
  assert.equal(grid.filter((d) => d.inMonth).length, 31)
  assert.deepEqual(gridRange(grid), { from: '2026-11-30', to: '2027-01-10' })
})

test('buildMonthGrid : mois qui commence un lundi, et février bissextile', () => {
  assert.equal(buildMonthGrid({ year: 2027, month: 1 })[0].key, '2027-02-01') // 1er février 2027 = lundi
  assert.equal(buildMonthGrid({ year: 2028, month: 1 }).filter((d) => d.inMonth).length, 29)
})

test('addDays traverse les mois, les années et le changement d\'heure', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
  // Changement d'heure en Amérique du Nord : 8 mars 2026 et 1er novembre 2026
  assert.equal(addDays('2026-03-07', 1), '2026-03-08')
  assert.equal(addDays('2026-03-08', 1), '2026-03-09')
  assert.equal(addDays('2026-11-01', 1), '2026-11-02')
})

test('shiftMonth et shiftMonthKeepDay', () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 })
  assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 })
  assert.equal(shiftMonthKeepDay('2027-01-31', 1), '2027-02-28') // borné au dernier jour
  assert.equal(shiftMonthKeepDay('2026-12-15', -1), '2026-11-15')
})

test('parseMonthParam / toMonthParam : aller-retour, valeurs invalides refusées', () => {
  assert.deepEqual(parseMonthParam('2026-12'), { year: 2026, month: 11 })
  assert.equal(toMonthParam({ year: 2026, month: 0 }), '2026-01')
  assert.equal(parseMonthParam('2026-13'), null)
  assert.equal(parseMonthParam('décembre'), null)
  assert.equal(parseMonthParam(null), null)
})

test('utcDayKey : une échéance à 17 h UTC reste sur son jour', () => {
  assert.equal(utcDayKey('2026-12-05T17:00:00.000Z'), '2026-12-05')
  assert.equal(utcDayKey('pas une date'), null)
})

test('groupEvents : réunion au jour local, tâche au jour UTC, réunions d\'abord puis par heure', () => {
  const meetingLate = { id: 'm2', title: 'Tard', starts_at: new Date(2026, 11, 5, 16, 0).toISOString() }
  const meetingEarly = { id: 'm1', title: 'Tôt', starts_at: new Date(2026, 11, 5, 9, 0).toISOString() }
  const tasks = [
    { id: 't2', title: 'Zèbre', due_date: '2026-12-05T17:00:00.000Z' },
    { id: 't1', title: 'Avion', due_date: '2026-12-05T17:00:00.000Z' },
    { id: 't3', title: 'Autre jour', due_date: '2026-12-06T17:00:00.000Z' },
  ]
  const byDay = groupEvents([meetingLate, meetingEarly, { id: 'x', starts_at: 'invalide' }], tasks)
  assert.deepEqual(byDay.get('2026-12-05').map((e) => e.id), ['m1', 'm2', 't1', 't2'])
  assert.deepEqual(byDay.get('2026-12-06').map((e) => e.id), ['t3'])
  assert.equal(byDay.get(toDayKey(new Date(2026, 11, 5, 9))).length, 4)
})

test('eventKind : réunion, tâche terminée, en retard (aujourd\'hui exclu), à venir', () => {
  const today = '2026-12-05'
  assert.equal(eventKind({ type: 'meeting' }, today), 'meeting')
  assert.equal(eventKind({ type: 'task', status: 'done', due_date: '2026-12-01T17:00:00Z' }, today), 'task-done')
  assert.equal(eventKind({ type: 'task', status: 'todo', due_date: '2026-12-04T17:00:00Z' }, today), 'task-overdue')
  assert.equal(eventKind({ type: 'task', status: 'todo', due_date: '2026-12-05T17:00:00Z' }, today), 'task')
})

test('eventLink : réunion, réunion d\'origine de la tâche, sinon Mes tâches', () => {
  assert.equal(eventLink({ type: 'meeting', id: 'm1' }), '/meetings/m1')
  assert.equal(eventLink({ type: 'task', id: 't1', meeting_id: 'm9' }), '/meetings/m9')
  assert.equal(eventLink({ type: 'task', id: 't1', meeting_id: null }), '/tasks')
})

test('moveFocus : flèches, Début/Fin de semaine, Page préc./suiv., touche ignorée', () => {
  const thu = '2026-12-03' // jeudi
  assert.equal(moveFocus(thu, 'ArrowLeft'), '2026-12-02')
  assert.equal(moveFocus(thu, 'ArrowRight'), '2026-12-04')
  assert.equal(moveFocus(thu, 'ArrowUp'), '2026-11-26')
  assert.equal(moveFocus(thu, 'ArrowDown'), '2026-12-10')
  assert.equal(moveFocus(thu, 'Home'), '2026-11-30') // lundi
  assert.equal(moveFocus(thu, 'End'), '2026-12-06') // dimanche
  assert.equal(moveFocus(thu, 'PageDown'), '2027-01-03')
  assert.equal(moveFocus(thu, 'PageUp'), '2026-11-03')
  assert.equal(moveFocus(thu, 'a'), null)
})

test('monthLabel et dayLabel : majuscule à la première lettre seulement', () => {
  assert.equal(monthLabel({ year: 2026, month: 11 }), 'Décembre 2026')
  assert.equal(dayLabel('2026-12-03'), 'Jeudi 3 décembre 2026')
})
