import { NavLink } from 'react-router-dom';

const LINKS = [
  { to: '/dispatch',    icon: '📡', label: 'Dispatch'     },
  { to: '/board',       icon: '⊞',  label: 'Weekly Board' },
  { to: '/dashboard',   icon: '◈',  label: 'Dashboard'    },
  { to: '/leaderboard', icon: '⬡',  label: 'Leaderboard'  },
  { to: '/drivers',     icon: '◉',  label: 'Drivers'      },
  { to: '/history',     icon: '🗂',  label: 'History'      },
  { to: '/settings',    icon: '⚙',  label: 'Settings'     },
];

const DB_LABEL = {
  local:      'Local only',
  connecting: 'Connecting…',
  connected:  'Cloud sync on',
  error:      'Sync error',
};

export default function Sidebar({ darkMode, onToggleDark, dbStatus = 'local', userEmail, onLogout }) {
  const initials = userEmail ? userEmail[0].toUpperCase() : '?';

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">UB</div>
        <div className="brand-text">
          <span className="brand-name">UpdateBoard</span>
          <span className="brand-sub">Fleet Manager</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {LINKS.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{l.icon}</span>
            <span className="nav-label">{l.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="dark-toggle" onClick={onToggleDark} title="Toggle dark mode">
          <span>{darkMode ? '☀' : '🌙'}</span>
          <span className="nav-label">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
        </button>

        <div className="sidebar-db-status" title={DB_LABEL[dbStatus]}>
          <span className={`db-dot db-dot--${dbStatus}`} />
          <span className="db-dot-label">{DB_LABEL[dbStatus]}</span>
        </div>

        {userEmail && (
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-email" title={userEmail}>{userEmail}</div>
            </div>
            <button className="sidebar-logout" onClick={onLogout} title="Sign out">⏻</button>
          </div>
        )}
      </div>
    </aside>
  );
}
