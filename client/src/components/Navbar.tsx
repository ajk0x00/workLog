import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import {
  Sun,
  Moon,
  Download,
  LogOut,
  User as UserIcon,
  LogIn,
  CheckCircle2,
  BookOpen,
  Sparkles,
  FileText,
} from 'lucide-react';

interface NavbarProps {
  currentTab: 'journal' | 'skills' | 'resume';
  onSelectTab: (tab: 'journal' | 'skills' | 'resume') => void;
  onOpenExport: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenExport,
  onOpenAuth,
  onOpenProfile,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="brand-logo" onClick={() => onSelectTab('journal')} style={{ cursor: 'pointer' }}>
            <div className="brand-icon">
              <CheckCircle2 size={18} />
            </div>
            <span>WorkLog</span>
          </div>

          {user && (
            <div className="pill-group">
              <button
                type="button"
                className={`pill-btn ${currentTab === 'journal' ? 'active-done' : ''}`}
                onClick={() => onSelectTab('journal')}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <BookOpen size={13} />
                <span>Work Journal</span>
              </button>
              <button
                type="button"
                className={`pill-btn ${currentTab === 'skills' ? 'active-done' : ''}`}
                onClick={() => onSelectTab('skills')}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <Sparkles size={13} color={currentTab === 'skills' ? '#eab308' : undefined} />
                <span>Skills Matrix</span>
              </button>
              <button
                type="button"
                className={`pill-btn ${currentTab === 'resume' ? 'active-done' : ''}`}
                onClick={() => onSelectTab('resume')}
                style={{ display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <FileText size={13} color={currentTab === 'resume' ? '#06b6d4' : undefined} />
                <span>Resume</span>
              </button>
            </div>
          )}
        </div>

        <div className="nav-actions">
          {user ? (
            <>
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
