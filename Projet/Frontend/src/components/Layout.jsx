import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Tableau de bord',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.75"/>
      </svg>
    ),
  },
  {
    to: '/meetings',
    label: 'Réunions',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/projects',
    label: 'Projets',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/tasks',
    label: 'Tâches',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    to: '/memory',
    label: 'Mémoire IA',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
        <path d="M9 19V6l12-3v13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="6" cy="19" r="3" stroke="currentColor" strokeWidth="1.75"/>
        <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.75"/>
      </svg>
    ),
    accent: 'ai',
  },
];

function NavItem({ to, label, icon, accent, collapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '0.625rem',
        padding: '0.5rem',
        justifyContent: 'center',
        borderRadius: 'var(--radius-md)',
        fontSize: '13px',
        fontWeight: isActive ? '500' : '400',
        color: isActive
          ? (accent === 'ai' ? 'var(--color-ai)' : 'var(--color-text)')
          : 'var(--color-text-muted)',
        background: isActive
          ? (accent === 'ai' ? 'var(--color-ai-glow)' : 'var(--color-surface-2)')
          : 'transparent',
        textDecoration: 'none',
        transition: 'color 120ms ease, background 120ms ease',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      })}
    >
      {icon}
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      )}
    </NavLink>
  );
}

function AccountMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          background: open ? 'var(--color-surface-2)' : 'transparent',
          border: '1px solid',
          borderColor: open ? 'var(--color-border-active)' : 'var(--color-border)',
          borderRadius: 'var(--radius-full)',
          padding: '0.25rem 0.625rem 0.25rem 0.25rem',
          cursor: 'pointer',
          transition: 'background 120ms ease, border-color 120ms ease',
        }}
        aria-label="Menu du compte"
      >
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366F1 0%, #A855F7 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', fontWeight: '600', color: '#fff',
          fontFamily: 'var(--font-display)', flexShrink: 0,
        }}>
          {initials}
        </div>
        <span style={{
          fontSize: '13px', fontWeight: '500', color: 'var(--color-text)',
          maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {user?.name || 'Compte'}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          style={{ color: 'var(--color-text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 150ms ease' }}>
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '220px',
          background: 'var(--color-surface-1)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden', zIndex: 100,
        }}>
          <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-text)' }}>{user?.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-faint)', marginTop: '2px' }}>{user?.email}</div>
          </div>
          <div style={{ padding: '0.375rem' }}>
            <button
              onClick={() => { setOpen(false); onLogout(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem', width: '100%',
                padding: '0.5rem 0.75rem', background: 'transparent', border: 'none',
                borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px',
                color: '#FCA5A5', fontFamily: 'var(--font-body)', textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              </svg>
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--color-canvas)' }}>

      {/* SIDEBAR */}
      <aside style={{
        width: collapsed ? '48px' : '216px',
        flexShrink: 0,
        background: 'var(--color-surface-1)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 200ms ease',
        overflow: 'hidden',
      }}>
        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '56px', borderBottom: '1px solid var(--color-border)',
          padding: '0 0.75rem', gap: '0.5rem',
        }}>
         <div style={{
  width: '32px', height: '32px', borderRadius: '8px',
  background: 'linear-gradient(135deg, #6366F1, #A855F7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}}>
  <svg width="19" height="19" viewBox="0 0 32 32" fill="none">
    <defs>
      <linearGradient id="wave-grad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stopColor="#FF3CAC"/>
        <stop offset="20%"  stopColor="#FF6B6B"/>
        <stop offset="40%"  stopColor="#FFD93D"/>
        <stop offset="60%"  stopColor="#6BCB77"/>
        <stop offset="80%"  stopColor="#4D96FF"/>
        <stop offset="100%" stopColor="#C77DFF"/>
      </linearGradient>
      <linearGradient id="dot-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#38BDF8"/>
        <stop offset="100%" stopColor="#C77DFF"/>
      </linearGradient>
    </defs>
    <path d="M5 5 L16 23 L27 5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1 14 Q4 10 7 14 Q10 18 13 14 Q16 10 19 14 Q22 18 25 14 Q28 10 31 14"
      stroke="url(#wave-grad)" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.9"/>
    <circle cx="16" cy="23" r="2.8" fill="url(#dot-grad)"/>
    <circle cx="16" cy="23" r="5" fill="url(#dot-grad)" opacity="0.18"/>
    <line x1="16" y1="17" x2="16" y2="14.5" stroke="url(#dot-grad)" strokeWidth="1.3" strokeLinecap="round" opacity="0.7"/>
    <line x1="19.5" y1="19" x2="21.2" y2="17.5" stroke="url(#dot-grad)" strokeWidth="1.3" strokeLinecap="round" opacity="0.7"/>
    <line x1="12.5" y1="19" x2="10.8" y2="17.5" stroke="url(#dot-grad)" strokeWidth="1.3" strokeLinecap="round" opacity="0.7"/>
  </svg>
</div>
          {!collapsed && (
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: '700',
              color: 'var(--color-text)', letterSpacing: '-0.02em', whiteSpace: 'nowrap',
            }}>Veridian</span>
          )}
        </div>

        {/* Navigation — PAS de minWidth ici, c'est ce qui causait le bug */}
        <nav style={{
          flex: 1, padding: '0.5rem 0.375rem',
          display: 'flex', flexDirection: 'column', gap: '2px',
        }}>
          {NAV_ITEMS.map(item => (
            <NavItem key={item.to} {...item} collapsed={collapsed} />
          ))}
        </nav>
      </aside>

      {/* ZONE PRINCIPALE */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Header */}
        <header style={{
          height: '56px', borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', padding: '0 1rem', gap: '0.75rem',
          background: 'var(--color-surface-1)', flexShrink: 0,
        }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--color-text-muted)', padding: '0.375rem',
              borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center',
            }}
            aria-label="Réduire le menu"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
              <line x1="3" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
          </button>

          <div style={{ flex: 1 }} />

          {/* Badge IA active */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.25rem 0.625rem', borderRadius: 'var(--radius-full)',
            background: 'var(--color-ai-glow)', border: '1px solid rgba(168,85,247,0.25)',
          }}>
            <div style={{
              width: '6px', height: '6px', borderRadius: '50%',
              background: 'var(--color-ai)', boxShadow: '0 0 6px var(--color-ai)',
            }} />
            <span style={{
              fontSize: '11px', fontWeight: '500', color: 'var(--color-ai)',
              fontFamily: 'var(--font-display)',
            }}>IA active</span>
          </div>

          {/* Menu compte (avatar + dropdown) */}
          <AccountMenu user={user} onLogout={handleLogout} />
        </header>

        <div style={{ flex: 1, padding: '1.5rem', overflow: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}