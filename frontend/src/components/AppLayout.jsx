import { useEffect } from 'react';
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom';
import { apiFetch } from '../api';
import { getUser, logout } from '../auth';
import './AppLayout.css';

const linksByRole = {
  parent: [
    { to: '/', label: 'Overview' },
    { to: '/schedule', label: 'Schedule' },
    { to: '/tasks', label: 'Tasks' },
    { to: '/observations', label: 'Observations' },
    { to: '/specialists', label: 'Specialists' },
    { to: '/documents', label: 'Documents' },
  ],
  specialist: [
    { to: '/', label: 'Linked children' },
    { to: '/observations', label: 'Observations' },
    { to: '/tasks', label: 'Tasks' },
    { to: '/schedule', label: 'Schedule' },
    { to: '/documents', label: 'Documents' },
    { to: '/ai-summary', label: 'AI summary' },
  ],
  child: [
    { to: '/tasks', label: 'Tasks' },
    { to: '/schedule', label: 'Schedule' },
  ],
};

export default function AppLayout() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const user = getUser();

  useEffect(() => {
    if (token) apiFetch('/api/me').catch(() => {});
  }, [token]);

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  const links = linksByRole[user.role] || [];

  function handleSignOut() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">Child Development Platform</span>
        <span>
          {user.name} ({user.role}){' '}
          <button className="btn" onClick={handleSignOut}>Sign out</button>
        </span>
      </header>
      <div className="app-body">
        <nav className="sidebar" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className="sidebar-link"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}