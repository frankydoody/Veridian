// src/pages/ProjectsPage.jsx
// Liste des projets de l'organisation

// ─── Composant ProjectCard ────────────────────────────────────────────────────
// Une carte par projet avec nom, description, stats et statut
function ProjectCard({ name, description, meetings, tasks, members, status, color }) {
  const statusStyle = {
    actif:    { color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
    pause:    { color: '#FFD93D', bg: 'rgba(255,217,61,0.12)' },
    terminé:  { color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' },
  }[status] || { color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }

  return (
    <div style={{
      background: 'var(--color-surface-1)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      padding: '1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
      // Barre colorée en haut pour identifier visuellement le projet
      borderTop: `3px solid ${color}`,
    }}>
      {/* Nom + badge statut */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: 'var(--color-text)' }}>
          {name}
        </h3>
        <span style={{
          fontSize: '11px', fontWeight: '500',
          color: statusStyle.color,
          background: statusStyle.bg,
          borderRadius: '999px',
          padding: '2px 10px',
        }}>
          {status}
        </span>
      </div>

      {/* Description */}
      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
        {description}
      </p>

      {/* Stats en bas : réunions / tâches / membres */}
      <div style={{
        display: 'flex',
        gap: '1.25rem',
        borderTop: '1px solid var(--color-border)',
        paddingTop: '0.875rem',
      }}>
        {[
          { label: 'Réunions', value: meetings },
          { label: 'Tâches',   value: tasks },
          { label: 'Membres',  value: members },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-text)' }}>
              {value}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
              {label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const projects = [
    {
      name: 'Projet Alpha',
      description: 'Refonte complète de l\'interface utilisateur et migration vers une architecture microservices.',
      meetings: 12, tasks: 34, members: 5,
      status: 'actif',
      color: 'var(--color-ai)',
    },
    {
      name: 'Projet Beta',
      description: 'Développement de la nouvelle application mobile iOS et Android pour les clients externes.',
      meetings: 4, tasks: 18, members: 3,
      status: 'actif',
      color: '#4D96FF',
    },
    {
      name: 'Projet Gamma',
      description: 'Audit de sécurité et mise en conformité RGPD de l\'ensemble des systèmes internes.',
      meetings: 7, tasks: 9, members: 2,
      status: 'pause',
      color: '#FFD93D',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text)' }}>
            Projets
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            {projects.length} projets dans l'organisation
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
          + Nouveau projet
        </button>
      </div>

      {/* Grille de cartes — s'adapte automatiquement à la largeur */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1rem',
      }}>
        {projects.map((p) => (
          <ProjectCard key={p.name} {...p} />
        ))}
      </div>

    </div>
  )
}