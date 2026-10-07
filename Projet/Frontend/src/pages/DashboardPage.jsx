// src/pages/DashboardPage.jsx
// Page d'accueil après connexion — affiche les statistiques clés de l'organisation

import { useAuth } from '../context/AuthContext'

// ─── Composant StatCard ───────────────────────────────────────────────────────
// Une carte qui affiche une statistique avec un titre, une valeur et une couleur
// Props :
//   label  → le texte descriptif (ex: "Réunions ce mois")
//   value  → la valeur à afficher (ex: "12")
//   color  → la couleur de l'accent (variable CSS)
function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      {/* Valeur en gros — l'information principale */}
      <span style={{
        fontSize: '2rem',
        fontWeight: '700',
        color: color || 'var(--color-text)',
        lineHeight: 1,
      }}>
        {value}
      </span>
      {/* Label descriptif en dessous */}
      <span style={{
        fontSize: '13px',
        color: 'var(--color-text-muted)',
      }}>
        {label}
      </span>
    </div>
  )
}

// ─── Composant RecentItem ─────────────────────────────────────────────────────
// Une ligne dans la liste d'activité récente
function RecentItem({ title, subtitle, dot }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 0',
      borderBottom: '1px solid var(--color-border)',
    }}>
      {/* Point de couleur qui identifie le type d'événement */}
      <div style={{
        width: '8px', height: '8px',
        borderRadius: '50%',
        background: dot || 'var(--color-ai)',
        flexShrink: 0,
      }} />
      <div>
        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text)' }}>
          {title}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  // On récupère l'utilisateur connecté depuis le contexte global d'auth
  const { user } = useAuth()

  // Données fictives pour l'instant — seront remplacées par de vrais appels API
  const stats = [
    { label: 'Réunions ce mois', value: '8',  color: 'var(--color-ai)' },
    { label: 'Décisions prises', value: '34', color: '#6BCB77' },
    { label: 'Tâches en cours',  value: '12', color: '#FFD93D' },
    { label: 'Projets actifs',   value: '3',  color: '#4D96FF' },
  ]

  const recent = [
    { title: 'Réunion Sprint 4 — terminée',        subtitle: 'Projet Alpha · il y a 2h',   dot: 'var(--color-ai)' },
    { title: 'Décision : migrer vers PostgreSQL',  subtitle: 'Projet Alpha · hier',         dot: '#6BCB77' },
    { title: 'Tâche assignée à Marie : wireframes',subtitle: 'Projet Beta · hier',          dot: '#FFD93D' },
    { title: 'Contradiction détectée',             subtitle: 'Projet Alpha · il y a 3 jours',dot: '#FF6B6B' },
    { title: 'Réunion Kick-off Beta',              subtitle: 'Projet Beta · il y a 5 jours',dot: 'var(--color-ai)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

      {/* En-tête de page */}
      <div>
        <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text)' }}>
          Bonjour, {user?.name?.split(' ')[0] || 'Francis'} 👋
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
          Voici un résumé de l'activité de ton organisation.
        </p>
      </div>

      {/* Grille de statistiques — 4 colonnes sur grand écran, 2 sur mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '1rem',
      }}>
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Activité récente */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem',
      }}>
        <h2 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)', marginBottom: '0.25rem' }}>
          Activité récente
        </h2>
        <div>
          {recent.map((r) => (
            <RecentItem key={r.title} {...r} />
          ))}
        </div>
      </div>

    </div>
  )
}