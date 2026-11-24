import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateProject, validateMeeting, validateTask, validateMemberEmail, hasErrors,
} from './validation.js'

test('validateProject : nom obligatoire et limité à 150 caractères', () => {
  assert.equal(validateProject({ name: '  ' }).name, 'Le nom du projet est obligatoire')
  assert.match(validateProject({ name: 'x'.repeat(151) }).name, /150/)
  assert.equal(hasErrors(validateProject({ name: 'Atlas', description: '' })), false)
})

test('validateMeeting : projet et titre obligatoires', () => {
  const errors = validateMeeting({ projectId: '', title: '' })
  assert.ok(errors.projectId)
  assert.ok(errors.title)
  assert.equal(hasErrors(validateMeeting({ projectId: 'p', title: 'Revue' })), false)
})

test('validateTask : acteur sans projet refusé, date au format AAAA-MM-JJ', () => {
  assert.ok(validateTask({ title: 'T', assigneeId: 'u' }).assigneeId)
  assert.ok(validateTask({ title: 'T', dueDate: '01/12/2026' }).dueDate)
  assert.equal(hasErrors(validateTask({ title: 'T', projectId: 'p', assigneeId: 'u', dueDate: '2026-12-01' })), false)
})

test('validateMemberEmail', () => {
  assert.ok(validateMemberEmail('').email)
  assert.ok(validateMemberEmail('marie').email)
  assert.equal(hasErrors(validateMemberEmail(' marie@example.com ')), false)
})
