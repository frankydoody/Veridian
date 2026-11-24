import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mailboxLink } from './mailbox.js'

test('mailboxLink : recherche filtrée sur le destinataire, adresse encodée', () => {
  assert.equal(
    mailboxLink('http://localhost:8025/', 'marie+test@example.com'),
    'http://localhost:8025/search?q=to%3Amarie%2Btest%40example.com',
  )
})

test('mailboxLink : sans courriel, la boîte entière', () => {
  assert.equal(mailboxLink('http://localhost:8025', ''), 'http://localhost:8025')
})

test('mailboxLink : absente ou autre protocole → aucun lien', () => {
  assert.equal(mailboxLink(null, 'a@b.c'), null)
  assert.equal(mailboxLink('', 'a@b.c'), null)
  assert.equal(mailboxLink('javascript:alert(1)', 'a@b.c'), null)
})
