// src/pages/MeetingsPage.jsx
// Liste des réunions de l'organisation

// ─── Composant MeetingRow ─────────────────────────────────────────────────────
// Une ligne dans le tableau des réunions
// Props : title, project, date, duration, status
function MeetingRow({ title, project, date, duration, status }) {
  // Chaque statut a sa propre couleur
  const statusStyle = {
    terminée:     { color: '#6BCB77', bg: 'rgba(107,203,119,0.12)' },
    'en cours':   { color: 'var(--color-ai)', bg: 'var(--color-ai-glow)' },
    planifiée:    { color: '#FFD93D', bg: 'rgba(255,217,61,0.12)' },
  }[status] || { color: 'var(--color-text-muted)', bg: 'var(--color-surface-2)' }

  return (
    <div style={{
      display: 'grid',
      // 4 colonnes : titre prend le plus d'espace, les autres fixes
      gridTemplateColumns: '1fr 140px 110px 90px 90px',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.875rem 1rem',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <span style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text)' }}>
        {title}
      </span>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {project}
      </span>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {date}
      </span>
      <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
        {duration}
      </span>
      {/* Badge de statut avec couleur dynamique */}
      <span style={{
        fontSize: '11px', fontWeight: '500',
        color: statusStyle.color,
        background: statusStyle.bg,
        borderRadius: '999px',
        padding: '2px 10px',
        textAlign: 'center',
        width: 'fit-content',
      }}>
        {status}
      </span>
    </div>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function MeetingsPage() {
  const meetings = [
    { title: 'Sprint 4 Review',       project: 'Projet Alpha', date: '2026-10-06', duration: '1h 12min', status: 'terminée' },
    { title: 'Kick-off Beta',         project: 'Projet Beta',  date: '2026-10-05', duration: '45min',    status: 'terminée' },
    { title: 'Architecture Decision', project: 'Projet Alpha', date: '2026-10-07', duration: '–',        status: 'en cours' },
    { title: 'Design Review',         project: 'Projet Beta',  date: '2026-10-08', duration: '–',        status: 'planifiée' },
    { title: 'Retrospective S3',      project: 'Projet Alpha', date: '2026-09-28', duration: '58min',    status: 'terminée' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* En-tête */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: '600', color: 'var(--color-text)' }}>
            Réunions
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            Historique et réunions planifiées
          </p>
        </div>
        {/* Bouton placeholder — fonctionnel dans un bloc futur */}
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
          + Nouvelle réunion
        </button>
      </div>

      {/* Tableau */}
      <div style={{
        background: 'var(--color-surface-1)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* En-tête du tableau */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 140px 110px 90px 90px',
          gap: '1rem',
          padding: '0.625rem 1rem',
          background: 'var(--color-surface-2)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {['Titre', 'Projet', 'Date', 'Durée', 'Statut'].map((h) => (
            <span key={h} style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Lignes */}
        {meetings.map((m) => (
          <MeetingRow key={m.title} {...m} />
        ))}
      </div>

    </div>
  )
}