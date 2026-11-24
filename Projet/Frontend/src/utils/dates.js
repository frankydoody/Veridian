// src/utils/dates.js
// Formatage des dates pour l'interface (fonctions pures, sans React : testables avec node --test).

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`

/**
 * Durée relative lisible, dans le passé OU dans le futur.
 *   passé  : « à l'instant », « il y a 5 min », « il y a 3 h », « il y a 2 jours »
 *   futur  : « dans 5 min », « dans 3 h », « dans 2 jours »
 * `now` est un paramètre pour pouvoir tester avec une heure fixe.
 */
export function formatRelative(value, now = Date.now()) {
  if (!value) return ''
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return ''

  const diff = time - now // > 0 : futur ; < 0 : passé
  const abs = Math.abs(diff)
  if (abs < MINUTE) return 'à l\'instant'

  let amount
  if (abs < HOUR) amount = `${Math.floor(abs / MINUTE)} min`
  else if (abs < DAY) amount = `${Math.floor(abs / HOUR)} h`
  else amount = plural(Math.floor(abs / DAY), 'jour')

  return diff > 0 ? `dans ${amount}` : `il y a ${amount}`
}

// « 12 nov. 2026 »
export function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

// « 12 nov. 2026, 14 h 30 »
export function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-CA', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/**
 * Échéance d'une tâche. Le backend enregistre une date sans heure à 17 h UTC
 * (voir BUG-03) : on lit donc le jour en UTC pour ne jamais décaler d'un jour.
 */
export function formatDueDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('fr-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Valeur pour <input type="date"> (AAAA-MM-JJ), lue en UTC pour la même raison.
export function toDateInputValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// Une tâche est en retard si son échéance (fin de journée) est passée et qu'elle n'est pas terminée.
export function isOverdue(task, now = Date.now()) {
  if (!task?.due_date || task.status === 'done') return false
  const due = new Date(task.due_date)
  if (Number.isNaN(due.getTime())) return false
  const endOfDueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate(), 23, 59, 59)
  return endOfDueDay < now
}
