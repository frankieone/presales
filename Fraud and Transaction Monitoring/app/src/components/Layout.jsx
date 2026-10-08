import { NavLink, useNavigate } from 'react-router-dom';
import { FileText, Landmark, LogOut, Menu, ShieldCheck, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { vertical } from '../config';
import Logo from './Logo';

// The customer portal is for completing an application: one login for the
// primary contact. Related people and the overview appear where the vertical
// has them.
const navItems = [
  { path: '/application', label: 'Application', icon: FileText },
  ...(vertical.people.enabled ? [{ path: '/people', label: vertical.people.navLabel, icon: Users }] : []),
  { path: '/dashboard', label: vertical.overview.title, icon: Landmark },
  { path: '/security', label: 'Security', icon: ShieldCheck },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-6 left-0 z-50 h-[calc(100%-1.5rem)] w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 hover:bg-gray-100 rounded">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-4 border-b border-gray-100">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">{vertical.container ? vertical.container.sidebarLabel : vertical.site.portalName}</p>
              <p className="font-medium text-gray-900 truncate">
                {vertical.container ? (user?.fundName || vertical.container.sidebarFallback) : user?.entityName}
              </p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        <header className="sticky top-6 z-30 bg-white border-b border-gray-200 px-4 py-3 lg:px-8">
          <div className="flex items-center justify-between">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg">
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center gap-4 ml-auto">
              <span className="text-sm text-gray-500">
                {user?.applicationId ? 'Application' : 'Member ID'}:{' '}
                <span className="font-medium text-gray-700">{user?.applicationId || `${user?.userId?.slice(0, 8)}...`}</span>
              </span>
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-8">{children}</main>

        <footer className="border-t border-gray-200 p-4 text-center text-sm text-gray-400">
          {vertical.brand.name} is a placeholder brand for demonstration only.
        </footer>
      </div>
    </div>
  );
}
