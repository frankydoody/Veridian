// src/components/SessionNotice.jsx
// Bandeau affiché au-dessus de la page de connexion quand on y a été renvoyé
// (jeton expiré ou invalide). Le message est lu une seule fois puis effacé.
import { useState } from 'react'
import { takeSessionMessage } from '../services/api.js'

export default function SessionNotice() {
  // Lecture au premier rendu seulement (l'initialiseur de useState ne s'exécute qu'une fois)
  const [message, setMessage] = useState(() => takeSessionMessage())
  if (!message) return null

  return (
    <div
      role="alert"
      style={{
        position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)', zIndex: 1000,
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
        background: 'var(--color-amber-bg)', border: '1px solid var(--color-border-amber)',
        color: 'var(--color-amber-text)', fontSize: '13px', maxWidth: 'calc(100vw - 2rem)',
      }}
    >
      <span>{message}</span>
      <button
        onClick={() => setMessage(null)}
        aria-label="Fermer le message"
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '16px' }}
      >
        ×
      </button>
    </div>
  )
}
