// src/components/ServiceStatus.jsx
// Pastilles d'état réelles dans l'en-tête : la clé Gemini est-elle configurée ?
// Les courriels partent-ils vraiment (SMTP) ou sont-ils seulement affichés (mode console) ?
// Lit GET /api/health, qui ne renvoie que des indicateurs (jamais de secret).
import { useEffect, useState } from 'react'

function Pill({ ok, label, title }) {
  const color = ok ? 'var(--color-ai)' : 'var(--color-amber)'
  return (
    <div title={title} style={{
      display: 'flex', alignItems: 'center', gap: '0.375rem',
      padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-full)',
      background: ok ? 'var(--color-ai-glow)' : 'var(--color-amber-bg)',
      border: `1px solid ${ok ? 'rgba(168,85,247,0.25)' : 'var(--color-border-amber)'}`,
    }}>
      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: '11px', fontWeight: '500', color, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  )
}

export default function ServiceStatus() {
  const [services, setServices] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => { if (!cancelled) setServices(data.services ?? null) })
      .catch(() => { if (!cancelled) setServices({ unreachable: true }) })
    return () => { cancelled = true }
  }, [])

  if (!services) return null
  if (services.unreachable) {
    return <Pill ok={false} label="Serveur injoignable" title="Le backend ne répond pas sur /api/health" />
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <Pill
        ok={services.ai}
        label={services.ai ? 'IA configurée' : 'IA non configurée'}
        title={services.ai ? "Une clé Gemini est présente dans .env (sa validité n'est pas vérifiée ici)" : 'GEMINI_API_KEY absente du fichier .env : l\'analyse des réunions ne fonctionnera pas'}
      />
      {services.email === 'console' && (
        <Pill
          ok={false}
          label="Courriels simulés"
          title="SMTP non configuré : les courriels sont affichés dans la console du backend, rien n'est envoyé"
        />
      )}
    </div>
  )
}
