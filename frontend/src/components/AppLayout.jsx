import { NavLink, Outlet } from 'react-router-dom';

const links = [
  { to: '/', label: 'Overview' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/observations', label: 'Observations' },
  { to: '/specialists', label: 'Specialists' },
  { to: '/documents', label: 'Documents' },
];

export default function AppLayout() {
  return (
    <div>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid #ccc' }}>
        <strong>Child Development Platform</strong>
        <button>Sign out</button>
      </header>
      <div style={{ display: 'flex' }}>
        <nav style={{ width: '200px', padding: '1rem', borderRight: '1px solid #ccc' }}>
          {links.map((link) => (
            <div key={link.to}>
              <NavLink to={link.to}>{link.label}</NavLink>
            </div>
          ))}
        </nav>
        <main style={{ flex: 1, padding: '1rem' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}