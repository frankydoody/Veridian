// src/utils/calendar.js
// Bloc 16 — Calcul du calendrier mensuel (fonctions pures, sans React : testables avec node --test).
//
// Un jour est représenté par une clé « AAAA-MM-JJ ». Deux règles de fuseau :
//  - une RÉUNION est un instant : on la place dans le jour LOCAL de l'utilisateur ;
//  - une ÉCHÉANCE de tâche est un jour fixé à 17 h UTC (voir BUG-03) : on lit le jour en UTC,
//    sinon une tâche du 5 pourrait apparaître le 4 ou le 6 selon le fuseau.
// Les dates locales sont créées à MIDI : un changement d'heure (été/hiver) ne fait jamais
// basculer un jour sur le précédent.

const pad = (n) => String(n).padStart(2, '0')

// Clé du jour LOCAL d'une date
export function toDayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Clé du jour UTC (échéances de tâches)
export function utcDayKey(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

// « AAAA-MM-JJ » → Date locale à midi
export function fromDayKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(key, days) {
  const d = fromDayKey(key)
  d.setDate(d.getDate() + days)
  return toDayKey(d)
}

// Mois suivant/précédent ; month va de 0 (janvier) à 11
export function shiftMonth({ year, month }, delta) {
  const d = new Date(year, month + delta, 1, 12)
  return { year: d.getFullYear(), month: d.getMonth() }
}

// Même jour du mois, borné au dernier jour (31 janvier + 1 mois → 28 ou 29 février)
export function shiftMonthKeepDay(key, delta) {
  const d = fromDayKey(key)
  const { year, month } = shiftMonth({ year: d.getFullYear(), month: d.getMonth() }, delta)
  const last = new Date(year, month + 1, 0, 12).getDate()
  return toDayKey(new Date(year, month, Math.min(d.getDate(), last), 12))
}

// « 2026-12 » (paramètre d'URL) → { year, month } ; null si invalide
export function parseMonthParam(value) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  if (month < 0 || month > 11 || year < 2000 || year > 2100) return null
  return { year, month }
}

export const toMonthParam = ({ year, month }) => `${year}-${pad(month + 1)}`

// Majuscule à la PREMIÈRE lettre seulement (« Mardi 17 novembre », pas « Mardi 17 Novembre »)
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

// « Décembre 2026 »
export function monthLabel({ year, month }) {
  return capitalize(new Date(year, month, 1, 12).toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' }))
}

// « Jeudi 5 décembre 2026 »
export function dayLabel(key) {
  return capitalize(fromDayKey(key).toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
}

export const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']

/**
 * Grille du mois : 6 semaines de 7 jours, commençant un LUNDI (usage au Québec et en France).
 * Toujours 42 cases : la hauteur du calendrier ne saute pas d'un mois à l'autre.
 * @returns {{ key: string, day: number, inMonth: boolean }[]}
 */
export function buildMonthGrid({ year, month }) {
  const first = new Date(year, month, 1, 12)
  const offset = (first.getDay() + 6) % 7 // lundi = 0 … dimanche = 6
  const start = toDayKey(new Date(year, month, 1 - offset, 12))
  return Array.from({ length: 42 }, (_, i) => {
    const key = addDays(start, i)
    const d = fromDayKey(key)
    return { key, day: d.getDate(), inMonth: d.getMonth() === month }
  })
}

// Plage demandée au backend : première et dernière case de la grille
export function gridRange(grid) {
  return { from: grid[0].key, to: grid[grid.length - 1].key }
}

/**
 * Regroupe réunions et tâches par jour.
 * Dans une journée : les réunions d'abord (par heure), puis les tâches (par titre).
 * @returns {Map<string, object[]>} clé du jour → événements { type, id, title, ... }
 */
export function groupEvents(meetings = [], tasks = []) {
  const byDay = new Map()
  const push = (key, event) => {
    if (!key) return
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(event)
  }
  for (const m of meetings) {
    const date = new Date(m.starts_at)
    if (Number.isNaN(date.getTime())) continue
    push(toDayKey(date), { ...m, type: 'meeting', time: date.getTime() })
  }
  for (const t of tasks) push(utcDayKey(t.due_date), { ...t, type: 'task' })

  for (const list of byDay.values()) {
    list.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'meeting' ? -1 : 1
      if (a.type === 'meeting') return a.time - b.time
      return a.title.localeCompare(b.title, 'fr')
    })
  }
  return byDay
}

/**
 * Catégorie d'affichage (couleur + légende) d'un événement.
 * Une tâche en retard : jour d'échéance passé (aujourd'hui exclu) et pas terminée.
 */
export function eventKind(event, todayKey) {
  if (event.type === 'meeting') return 'meeting'
  if (event.status === 'done') return 'task-done'
  if (utcDayKey(event.due_date) < todayKey) return 'task-overdue'
  return 'task'
}

// Lien de l'événement : la réunion, ou la réunion d'origine de la tâche, sinon « Mes tâches »
export function eventLink(event) {
  if (event.type === 'meeting') return `/meetings/${event.id}`
  if (event.meeting_id) return `/meetings/${event.meeting_id}`
  return '/tasks'
}

/**
 * Navigation au clavier dans la grille (modèle « grid » de WAI-ARIA).
 * Flèches : jour/semaine ; Début/Fin : début/fin de semaine ; Page préc./suiv. : mois.
 * @returns la nouvelle clé du jour, ou null si la touche n'est pas gérée
 */
export function moveFocus(key, keyName) {
  const weekday = (fromDayKey(key).getDay() + 6) % 7
  switch (keyName) {
    case 'ArrowLeft': return addDays(key, -1)
    case 'ArrowRight': return addDays(key, 1)
    case 'ArrowUp': return addDays(key, -7)
    case 'ArrowDown': return addDays(key, 7)
    case 'Home': return addDays(key, -weekday)
    case 'End': return addDays(key, 6 - weekday)
    case 'PageUp': return shiftMonthKeepDay(key, -1)
    case 'PageDown': return shiftMonthKeepDay(key, 1)
    default: return null
  }
}
