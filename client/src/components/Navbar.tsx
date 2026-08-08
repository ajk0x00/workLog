import React from 'react';
import { useAuth } from '../context/AuthContext.js';
import { useTheme } from '../context/ThemeContext.js';
import type { StatsData } from '../types/index.js';
import {
  Flame,
  Sun,
  Moon,
  ClipboardList,
  Download,
  LogOut,
  User as UserIcon,
  Clock,
  LogIn,
  CheckCircle2,
} from 'lucide-react';

interface NavbarProps {
  stats: StatsData | null;
  onOpenStandup: () => void;
  onOpenExport: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  stats,
  onOpenStandup,
  onOpenExport,
  onOpenAuth,
  onOpenProfile,
}) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const todayHours = stats?.today?.hours ?? 0;
  const goalHours = stats?.dailyGoalHours ?? 8;
  const goalPercent = Math.min(100, Math.round((todayHours / goalHours) * 100));

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
              {/* Streak Badge */}
              <div className="streak-badge" title={`${stats?.streak || 0} day logging streak!`}>
                <Flame size={15} />
                <span>{stats?.streak || 0}d streak</span>
              </div>

              {/* Today's Goal Progress */}
              <div
                className="hours-progress-badge"
                title={`Today: ${todayHours}h / ${goalHours}h goal (${goalPercent}%)`}
              >
                <Clock size={14} />
                <span>
                  {todayHours}/{goalHours}h
                </span>
                <div className="progress-mini-bar">
                  <div
                    className="progress-mini-fill"
                    style={{ width: `${goalPercent}%` }}
                  />
                </div>
              </div>

              {/* Standup Modal Trigger */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenStandup}
                title="Generate Daily Standup Report"
              >
                <ClipboardList size={14} />
                <span>Standup</span>
              </button>

              {/* Export Modal Trigger */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenExport}
                title="Export Logs (Markdown, CSV, JSON)"
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

              {/* User Profile & Signout */}
              <button
                className="btn btn-secondary btn-sm"
                onClick={onOpenProfile}
                title="Profile & Settings"
              >
                <UserIcon size={14} />
                <span>{user.username}</span>
              </button>

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
