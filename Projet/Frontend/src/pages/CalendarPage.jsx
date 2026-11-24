// src/pages/CalendarPage.jsx — Calendrier de projet (bloc 16)
//
// Vue mensuelle : réunions et échéances de tâches, pour tous mes projets ou un seul.
// Le mois et le projet sont dans l'URL (?mois=2026-12&projet=…) : un lien peut être partagé,
// et le bouton « Précédent » du navigateur fonctionne.
//
// Accessibilité : la grille suit le modèle « grid » de WAI-ARIA. Une seule case est atteignable
// par Tab (tabindex « itinérant ») ; les flèches déplacent le jour actif, Page préc./suiv. change
// de mois, Entrée ouvre la liste du jour sous la grille. Les couleurs sont doublées d'un libellé
// (légende et texte des événements) : l'information ne dépend jamais de la couleur seule.
import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { inputStyle } from '../components/form.jsx'
import { formatDateTime } from '../utils/dates.js'
import {
  buildMonthGrid, gridRange, groupEvents, eventKind, eventLink, moveFocus, monthLabel, dayLabel,
  parseMonthParam, toMonthParam, shiftMonth, toDayKey, fromDayKey, WEEKDAYS,
} from '../utils/calendar.js'

const KINDS = {
  meeting: { label: 'Réunion', color: 'var(--color-ai)', bg: 'var(--color-ai-glow)' },
  task: { label: 'Échéance', color: '#4D96FF', bg: 'rgba(77, 150, 255, 0.14)' },
  'task-overdue': { label: 'En retard', color: 'var(--color-danger)', bg: 'var(--color-danger-muted)' },
  'task-done': { label: 'Terminée', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
}
const MAX_PER_CELL = 3

function eventText(event) {
  if (event.type === 'meeting') {
    const time = new Date(event.starts_at).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })
    return event.scheduled_at ? `${time} ${event.title}` : event.title
  }
  return event.title
}

function EventChip({ event, todayKey }) {
  const kind = KINDS[eventKind(event, todayKey)]
  return (
    <Link
      to={eventLink(event)}
      title={`${kind.label} : ${event.title}${event.project_name ? ` (${event.project_name})` : ''}`}
      // La case gère le clavier : le lien ne doit pas capter Tab ni les flèches
      tabIndex={-1}
      onClick={(e) => e.stopPropagation()}
      style={{
        display: 'block', fontSize: '11px', lineHeight: 1.3, padding: '1px 4px', borderRadius: '4px',
        background: kind.bg, color: kind.color, textDecoration: 'none', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderLeft: `3px solid ${kind.color}`,
      }}
    >
      {eventText(event)}
    </Link>
  )
}

function Legend() {
  return (
    <ul aria-label="Légende" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', listStyle: 'none', margin: 0, padding: 0 }}>
      {Object.entries(KINDS).map(([key, k]) => (
        <li key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '12px', color: 'var(--color-text-muted)' }}>
          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 2, background: k.color }} />
          {k.label}
        </li>
      ))}
    </ul>
  )
}

function DayDetails({ dayKey, events, todayKey }) {
  return (
    <section aria-labelledby="day-details-title" style={{
      background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
    }}>
      <h2 id="day-details-title" style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 0.75rem' }}>
        {dayLabel(dayKey)}
      </h2>
      {events.length === 0 && <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: 0 }}>Rien de prévu ce jour-là.</p>}
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {events.map((event) => {
          const kind = KINDS[eventKind(event, todayKey)]
          return (
            <li key={`${event.type}-${event.id}`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'baseline', fontSize: '13px' }}>
              <span style={{
                fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px',
                background: kind.bg, color: kind.color, whiteSpace: 'nowrap',
              }}>{kind.label}</span>
              <span style={{ minWidth: 0 }}>
                <Link to={eventLink(event)} style={{ color: 'var(--color-text)', fontWeight: 500 }}>{event.title}</Link>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {event.project_name && ` · ${event.project_name}`}
                  {event.type === 'meeting' && ` · ${event.scheduled_at ? formatDateTime(event.starts_at) : 'date de création (aucune date prévue)'}`}
                  {event.type === 'task' && ` · ${event.assignee || 'sans acteur'}${event.due_estimated ? ' · date estimée' : ''}`}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function CalendarPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  // Aujourd'hui, lu une seule fois à l'ouverture de la page
  const [todayKey] = useState(() => toDayKey(new Date()))
  const today = fromDayKey(todayKey)

  const current = parseMonthParam(params.get('mois')) ?? { year: today.getFullYear(), month: today.getMonth() }
  const projectId = params.get('projet') ?? ''
  const onlyMine = params.get('miennes') === '1'

  const grid = buildMonthGrid(current) // 42 cases : calcul négligeable à chaque rendu
  const range = gridRange(grid)

  const [projects, setProjects] = useState([])
  // Résultat de la DERNIÈRE requête reçue ; « chargement » = la requête affichée n'est pas celle demandée
  const requestKey = `${range.from}|${range.to}|${projectId}`
  const [result, setResult] = useState({ key: null, meetings: [], tasks: [], error: '' })
  const loading = result.key !== requestKey
  const error = result.error
  // Jour actif : aujourd'hui s'il est dans la grille, sinon le 1er du mois
  const [activeKey, setActiveKey] = useState(null)
  const cellRefs = useRef(new Map())
  const focusAfterRender = useRef(false)

  const inGrid = (key) => grid.some((d) => d.key === key)
  const firstOfMonth = grid.find((d) => d.inMonth).key
  const active = activeKey && inGrid(activeKey) ? activeKey : (inGrid(todayKey) ? todayKey : firstOfMonth)

  useEffect(() => {
    api.get('/projects').then((d) => setProjects(d.projects ?? [])).catch(() => setProjects([]))
  }, [])

  useEffect(() => {
    // Une réponse arrivée après un changement de mois est ignorée (elle concerne l'ancien mois)
    let cancelled = false
    const query = new URLSearchParams({ from: range.from, to: range.to })
    if (projectId) query.set('projectId', projectId)
    api.get(`/calendar?${query}`)
      .then((d) => { if (!cancelled) setResult({ key: requestKey, meetings: d.meetings ?? [], tasks: d.tasks ?? [], error: '' }) })
      .catch((err) => { if (!cancelled) setResult({ key: requestKey, meetings: [], tasks: [], error: err.message }) })
    return () => { cancelled = true }
  }, [range.from, range.to, projectId, requestKey])

  // Après un changement de jour au clavier, la case visée reçoit le focus.
  // En changeant de mois, React affiche d'abord le nouveau jour actif, PUIS le nouveau mois
  // (mise à jour de l'URL) : on attend que la case visée existe vraiment avant de lui
  // donner le focus, sinon il tombe sur une case qui disparaît aussitôt (focus perdu).
  useEffect(() => {
    if (!focusAfterRender.current) return
    const cell = cellRefs.current.get(activeKey)
    if (cell) {
      focusAfterRender.current = false
      cell.focus()
    }
  })

  const tasks = onlyMine ? result.tasks.filter((t) => t.assignee_id === user?.id) : result.tasks
  const byDay = groupEvents(result.meetings, tasks)

  function updateParams(changes) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next)
  }

  function goToMonth(month, dayKey = null) {
    setActiveKey(dayKey)
    updateParams({ mois: toMonthParam(month) })
  }

  function handleKeyDown(e) {
    const target = moveFocus(active, e.key)
    if (!target) return
    e.preventDefault()
    focusAfterRender.current = true
    setActiveKey(target)
    const d = fromDayKey(target)
    if (d.getMonth() !== current.month || d.getFullYear() !== current.year) {
      goToMonth({ year: d.getFullYear(), month: d.getMonth() }, target)
    }
  }

  const weeks = Array.from({ length: 6 }, (_, w) => grid.slice(w * 7, w * 7 + 7))
  const navButton = {
    background: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)',
    borderRadius: 'var(--radius-md)', padding: '0.4rem 0.75rem', fontSize: '13px', cursor: 'pointer',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>Calendrier</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', margin: '0.25rem 0 0' }}>
            Réunions et échéances des tâches de vos projets.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="calendar-project" style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Projet</label>
          <select id="calendar-project" style={{ ...inputStyle, width: 'auto', minWidth: '180px' }} value={projectId}
            onChange={(e) => updateParams({ projet: e.target.value })}>
            <option value="">Tous mes projets</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label style={{ fontSize: '13px', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <input type="checkbox" checked={onlyMine} onChange={(e) => updateParams({ miennes: e.target.checked ? '1' : '' })} />
            Seulement mes tâches
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" style={navButton} onClick={() => goToMonth(shiftMonth(current, -1))} aria-label="Mois précédent">‹</button>
        <button type="button" style={navButton} onClick={() => goToMonth(shiftMonth(current, 1))} aria-label="Mois suivant">›</button>
        <button type="button" style={navButton}
          onClick={() => goToMonth({ year: today.getFullYear(), month: today.getMonth() }, todayKey)}>
          Aujourd'hui
        </button>
        <h2 id="calendar-month" aria-live="polite" style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 0 0.5rem' }}>
          {monthLabel(current)}
        </h2>
        <span style={{ flex: 1 }} />
        {loading && <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>Chargement…</span>}
        <Legend />
      </div>

      {error && (
        <div role="alert" style={{ padding: '0.6rem 0.8rem', borderRadius: 'var(--radius-md)', background: 'var(--color-danger-muted)', color: 'var(--color-danger)', fontSize: '13px' }}>
          Impossible de charger le calendrier : {error}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table role="grid" aria-labelledby="calendar-month" onKeyDown={handleKeyDown}
          style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)', padding: '0.4rem', textAlign: 'left' }}>{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].key}>
                {week.map((day) => {
                  const events = byDay.get(day.key) ?? []
                  const isToday = day.key === todayKey
                  const isActive = day.key === active
                  const count = events.length
                  return (
                    <td
                      key={day.key}
                      ref={(el) => { if (el) cellRefs.current.set(day.key, el); else cellRefs.current.delete(day.key) }}
                      role="gridcell"
                      tabIndex={isActive ? 0 : -1}
                      aria-selected={isActive}
                      aria-current={isToday ? 'date' : undefined}
                      aria-label={`${dayLabel(day.key)}${count ? `, ${count} événement${count > 1 ? 's' : ''}` : ', aucun événement'}`}
                      onClick={() => setActiveKey(day.key)}
                      style={{
                        verticalAlign: 'top', height: '104px', padding: '0.3rem', cursor: 'pointer',
                        border: '1px solid var(--color-border)',
                        background: isActive ? 'var(--color-surface-2)' : (day.inMonth ? 'var(--color-surface-1)' : 'transparent'),
                        outline: isActive ? '2px solid var(--color-primary)' : 'none', outlineOffset: '-2px',
                      }}
                    >
                      <div aria-hidden="true" style={{
                        fontSize: '12px', fontWeight: isToday ? 700 : 500, marginBottom: '0.25rem',
                        color: day.inMonth ? 'var(--color-text)' : 'var(--color-text-faint)',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        minWidth: '22px', height: '22px', borderRadius: '11px',
                        background: isToday ? 'var(--color-primary)' : 'transparent',
                      }}>
                        {day.day}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {events.slice(0, MAX_PER_CELL).map((event) => (
                          <EventChip key={`${event.type}-${event.id}`} event={event} todayKey={todayKey} />
                        ))}
                        {count > MAX_PER_CELL && (
                          <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>+ {count - MAX_PER_CELL} autre{count - MAX_PER_CELL > 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--color-text-faint)', margin: '-0.5rem 0 0' }}>
        Clavier : flèches pour changer de jour, Page préc./suiv. pour changer de mois, Début/Fin pour la semaine.
      </p>

      <DayDetails dayKey={active} events={byDay.get(active) ?? []} todayKey={todayKey} />
    </div>
  )
}
