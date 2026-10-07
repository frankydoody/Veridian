import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Link, useNavigate } from 'react-router-dom';

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--color-canvas)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
    }}>
      {/* Halo de fond */}
      <div style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '300px',
        background: 'radial-gradient(ellipse, rgba(168,85,247,0.10) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>

        {/* Logo + marque */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.625rem',
            marginBottom: '0.75rem',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 19V6l12-3v13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="6" cy="19" r="3" stroke="#fff" strokeWidth="2"/>
                <circle cx="18" cy="16" r="3" stroke="#fff" strokeWidth="2"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '22px',
              fontWeight: '700',
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}>Veridian</span>
          </div>
          <p style={{
            color: 'var(--color-text-muted)',
            fontSize: '13px',
            margin: 0,
          }}>Mémoire organisationnelle alimentée par l'IA</p>
        </div>

        {/* Carte formulaire */}
        <div style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
        }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '20px',
            fontWeight: '600',
            color: 'var(--color-text)',
            margin: '0 0 1.5rem',
          }}>Créer un compte</h1>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--color-text-muted)',
              }}>Nom complet</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jean Dupont"
                required
                style={{
                  background: 'var(--color-canvas)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.625rem 0.875rem',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                  width: '100%',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--color-text-muted)',
              }}>Courriel</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                required
                style={{
                  background: 'var(--color-canvas)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.625rem 0.875rem',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                  width: '100%',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <label style={{
                fontSize: '13px',
                fontWeight: '500',
                color: 'var(--color-text-muted)',
              }}>Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                style={{
                  background: 'var(--color-canvas)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.625rem 0.875rem',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  fontFamily: 'var(--font-body)',
                  outline: 'none',
                  transition: 'border-color 150ms ease',
                  width: '100%',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
              <span style={{ fontSize: '11px', color: 'var(--color-text-faint)' }}>
                Minimum 8 caractères
              </span>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.30)',
                borderRadius: 'var(--radius-md)',
                padding: '0.625rem 0.875rem',
                color: '#FCA5A5',
                fontSize: '13px',
              }} role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.5rem',
                background: loading
                  ? 'rgba(99,102,241,0.5)'
                  : 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                color: '#fff',
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: 'var(--font-display)',
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'opacity 150ms ease',
                width: '100%',
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => { if (!loading) e.target.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.target.style.opacity = '1'; }}
            >
              {loading ? 'Création en cours…' : 'Créer mon compte'}
            </button>
          </form>
        </div>

        {/* Lien connexion */}
        <p style={{
          textAlign: 'center',
          marginTop: '1.25rem',
          fontSize: '13px',
          color: 'var(--color-text-muted)',
        }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{
            color: 'var(--color-primary)',
            textDecoration: 'none',
            fontWeight: '500',
          }}>
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
