// src/pages/TasksPage.jsx
// Liste des tâches extraites des réunions et assignées aux membres

import { useState } from 'react'

// ─── Composant TaskRow ────────────────────────────────────────────────────────
// Une ligne de tâche avec checkbox visuelle, assigné, projet et priorité
function TaskRow({ title, assignee, project, priority, done }) {
  // useState local pour cocher/décocher — sera remplacé par un appel API
  const [checked, setChecked] = useState(done)

  const priorityStyle = {
    haute:   { color: '#FF6B6B', bg: 'rgba(255,107,107,0.12)' },
    moyenne: { color: '#FFD93D', bg: 'rgba(255,217,61,0.12)' },
    basse:   { color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
  }[priority] || { color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '32px 1fr 120px 130px 80px',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.875rem 1rem',
      borderBottom: '1px solid var(--color-border)',
      // Tâche complétée → légèrement atténuée
      opacity: checked ? 0.5 : 1,
      transition: 'opacity 200ms ease',
    }}>

      {/* Checkbox cliquable */}
      <div
        onClick={() => setChecked(!checked)}
        style={{
          width: '18px', height: '18px',
          borderRadius: '5px',
          border: checked ? 'none' : '2px solid var(--color-border)',
          background: checked ? 'var(--color-ai)' : 'transparent',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {/* Titre avec trait si complétée */}
      <span style={{
        fontSize: '13px',
        fontWeight: '500',
        color: 'var(--color-text)',
        textDecoration: checked ? 'line-through' : 'none',
      }}>
        {title}
      </span>

      {/* Assigné */}
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {assignee}
      </span>

      {/* Projet */}
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {project}
      </span>

      {/* Badge priorité */}
      <span style={{
        fontSize: '11px', fontWeight: '500',
        color: priorityStyle.color,
        background: priorityStyle.bg,
        borderRadius: '999px',
        padding: '2px 10px',
        textAlign: 'center',
        width: 'fit-content',
      }}>
        {priority}
      </span>

    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function TasksPage() {
  // Filtre actif : 'toutes' | 'en cours' | 'terminées'
  const [filter, setFilter] = useState('toutes')

  const tasks = [
    { title: 'Créer les wireframes mobile',       assignee: 'Marie D.',  project: 'Projet Beta',  priority: 'haute',   done: false },
    { title: 'Migrer la base de données',          assignee: 'Francis C.',project: 'Projet Alpha', priority: 'haute',   done: false },
    { title: 'Rédiger les tests unitaires',        assignee: 'Jean P.',   project: 'Projet Alpha', priority: 'moyenne', done: false },
    { title: 'Audit des dépendances npm',          assignee: 'Francis C.',project: 'Projet Gamma', priority: 'basse',   done: true  },
    { title: 'Présentation client v2',             assignee: 'Marie D.',  project: 'Projet Beta',  priority: 'moyenne', done: false },
    { title: 'Corriger bug pagination',            assignee: 'Jean P.',   project: 'Projet Alpha', priority: 'basse',   done: true  },
  ]

  // Filtrage selon l'onglet actif
  const filtered = tasks.filter((t) => {
    if (filter === 'en cours')  return !t.done
    if (filter === 'terminées') return t.done
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text)' }}>
            Tâches
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Extraites automatiquement des réunions
          </p>
        </div>
        <button style={{
          background: 'var(--color-ai)',
          color: '#fff',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 1rem',
          fontSize: '13px',
          fontWeight: '500',
          cursor: 'pointer',
        }}>
          + Nouvelle tâche
        </button>
      </div>

      {/* Onglets de filtre */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {['toutes', 'en cours', 'terminées'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.375rem 0.875rem',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              // Onglet actif → fond coloré, inactif → transparent
              background: filter === f ? 'var(--color-ai-glow)' : 'transparent',
              color: filter === f ? 'var(--color-ai)' : 'var(--color-text-muted)',
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* En-tête colonnes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 120px 130px 80px',
          gap: '1rem',
          padding: '0.625rem 1rem',
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span />
          {['Tâche', 'Assigné', 'Projet', 'Priorité'].map((h) => (
            <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Lignes filtrées */}
        {filtered.map((t) => (
          <TaskRow key={t.title} {...t} />
        ))}

        {/* Message si aucune tâche */}
        {filtered.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '13px' }}>
            Aucune tâche dans cette catégorie.
          </div>
        )}
      </div>

    </div>
  )
}