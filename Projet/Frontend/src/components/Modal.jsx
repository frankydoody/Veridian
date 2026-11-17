// src/components/Modal.jsx
// Fenêtre de dialogue accessible : role="dialog", fermeture par Échap ou clic sur le fond,
// focus placé sur le premier champ à l'ouverture.
import { useEffect, useRef } from 'react'

export default function Modal({ title, onClose, children, width = 520 }) {
  const panelRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    // Focus sur le premier champ (clavier et lecteurs d'écran)
    panelRef.current?.querySelector('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          width: '100%', maxWidth: `${width}px`, maxHeight: 'calc(100vh - 2rem)', overflowY: 'auto',
          background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', padding: '1.5rem', boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 id="modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--color-text)' }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: '20px', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
