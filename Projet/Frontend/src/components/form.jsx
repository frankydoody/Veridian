// src/components/form.jsx
// Éléments de formulaire partagés (bloc 13) : même apparence partout,
// étiquette reliée au champ (htmlFor/id) et message d'erreur annoncé aux lecteurs d'écran.

export const inputStyle = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
  color: 'var(--color-text)',
  fontSize: '13px',
  fontFamily: 'var(--font-body)',
}

export function Field({ id, label, error, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.9rem' }}>
      <label htmlFor={id} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      {children}
      {hint && !error && <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>{hint}</span>}
      {error && (
        <span id={`${id}-error`} role="alert" style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
          {error}
        </span>
      )}
    </div>
  )
}

// Erreur renvoyée par le serveur (validation, accès, conflit...)
export function FormError({ message }) {
  if (!message) return null
  return (
    <div role="alert" style={{
      padding: '0.6rem 0.8rem', marginBottom: '0.9rem', borderRadius: 'var(--radius-md)',
      background: 'var(--color-danger-muted)', color: 'var(--color-danger)', fontSize: '13px',
    }}>
      {message}
    </div>
  )
}

export function Button({ variant = 'primary', children, ...props }) {
  const styles = {
    primary: { background: 'var(--color-ai)', color: '#fff', border: 'none' },
    secondary: { background: 'transparent', color: 'var(--color-text)', border: '1px solid var(--color-border)' },
    danger: { background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' },
  }
  return (
    <button
      {...props}
      style={{
        padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
        cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.6 : 1,
        ...styles[variant], ...props.style,
      }}
    >
      {children}
    </button>
  )
}

export function FormActions({ children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
      {children}
    </div>
  )
}
