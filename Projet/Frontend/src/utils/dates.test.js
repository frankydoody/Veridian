// Tests des utilitaires de dates. Lancer : cd Projet/Frontend && npm test
// Testeur intégré à Node (node:test) : aucune dépendance à installer.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatRelative, formatDueDate, toDateInputValue, isOverdue } from './dates.js'

const NOW = Date.parse('2026-11-16T12:00:00Z')
const MIN = 60 * 1000

test('formatRelative : passé', () => {
  assert.equal(formatRelative(NOW - 30 * 1000, NOW), 'à l\'instant')
  assert.equal(formatRelative(NOW - 5 * MIN, NOW), 'il y a 5 min')
  assert.equal(formatRelative(NOW - 3 * 60 * MIN, NOW), 'il y a 3 h')
  assert.equal(formatRelative(NOW - 24 * 60 * MIN, NOW), 'il y a 1 jour')
  assert.equal(formatRelative(NOW - 3 * 24 * 60 * MIN, NOW), 'il y a 3 jours')
})

test('formatRelative : futur (régression BUG-10, « il y a -2880 min »)', () => {
  const inTwoDays = NOW + 2 * 24 * 60 * MIN
  assert.equal(formatRelative(inTwoDays, NOW), 'dans 2 jours')
  assert.equal(formatRelative(NOW + 10 * MIN, NOW), 'dans 10 min')
  assert.doesNotMatch(formatRelative(inTwoDays, NOW), /-/)
})

test('formatRelative : valeur absente ou invalide', () => {
  assert.equal(formatRelative(null, NOW), '')
  assert.equal(formatRelative('pas une date', NOW), '')
})

test('formatDueDate : une date à 17 h UTC garde son jour', () => {
  assert.match(formatDueDate('2026-11-12T17:00:00Z'), /12/)
})

test('toDateInputValue : format AAAA-MM-JJ', () => {
  assert.equal(toDateInputValue('2026-11-12T17:00:00Z'), '2026-11-12')
  assert.equal(toDateInputValue(null), '')
})

test('isOverdue : échéance passée et tâche non terminée', () => {
  assert.equal(isOverdue({ due_date: '2026-11-10T17:00:00Z', status: 'todo' }, NOW), true)
  assert.equal(isOverdue({ due_date: '2026-11-10T17:00:00Z', status: 'done' }, NOW), false)
  assert.equal(isOverdue({ due_date: '2026-11-16T17:00:00Z', status: 'todo' }, NOW), false) // aujourd'hui
  assert.equal(isOverdue({ due_date: null, status: 'todo' }, NOW), false)
})
