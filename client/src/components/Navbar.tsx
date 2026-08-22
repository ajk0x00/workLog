import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import type { StatsData } from '../types/index.js';
import {
  Flame,
  Sun,
  Moon,
  Download,
  LogOut,
  User as UserIcon,
  LogIn,
  CheckCircle2,
} from 'lucide-react';

interface NavbarProps {
  stats: StatsData | null;
  onOpenExport: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  onOpenExport,
  onOpenAuth,
  onOpenProfile,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div className="brand-logo">
          <div className="brand-icon">
            <CheckCircle2 size={18} />
          </div>
          <span>WorkLog</span>
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              {/* Shift Streak Badge */}
              <div className="streak-badge" title={`${stats?.streak || 0} consecutive shift logging streak!`}>
                <Flame size={15} />
                <span>{stats?.streak || 0}d streak</span>
              </div>

              {/* Export Modal Trigger */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenExport}
                title="Export Shift Logs (Markdown, CSV, JSON)"
              >
                <Download size={14} />
                <span>Export</span>
              </button>

              {/* Theme Toggle */}
              <button
                className="btn btn-icon btn-sm"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              {/* User Profile */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenProfile}
                title="Profile & Settings"
              >
                <UserIcon size={14} />
                <span>{user.username}</span>
              </button>

              {/* Sign Out */}
              <button
                className="btn btn-icon btn-sm btn-danger-ghost"
                onClick={() => logout()}
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              {/* Theme Toggle */}
              <button
                className="btn btn-icon btn-sm"
                onClick={toggleTheme}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <button className="btn btn-primary btn-sm" onClick={onOpenAuth}>
                <LogIn size={15} />
                <span>Sign In</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
