import React from 'react';
import type { StatsData } from '../types/index.js';
import { Flame, Clock, TrendingUp } from 'lucide-react';

interface StatsOverviewProps {
  stats: StatsData | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  if (!stats) return null;

  const todayHours = stats.today.hours || 0;
  const goalHours = stats.dailyGoalHours || 8;
  const goalPercent = Math.min(100, Math.round((todayHours / goalHours) * 100));

  // Find max minutes for sparkline scaling
  const maxSparkMinutes = Math.max(
    ...stats.last7Days.map((d) => d.minutes),
    goalHours * 60,
    60
  );

  return (
    <div className="stats-card">
      <div className="stats-grid">
        {/* Streak */}
        <div className="stat-item">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={14} color="#f59e0b" />
            <span>Streak</span>
          </div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.streak >= 3 ? '🔥 On a great roll!' : 'Keep logging daily!'}
          </span>
        </div>

        {/* Today's Hours & Goal */}
        <div className="stat-item">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={14} color="var(--accent-primary)" />
            <span>Today's Hours</span>
          </div>
          <div className="stat-value">
            {todayHours}h <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>/ {goalHours}h</span>
          </div>
          <div className="progress-mini-bar" style={{ width: '100%', height: 5, marginTop: 4 }}>
            <div
              className="progress-mini-fill"
              style={{
                width: `${goalPercent}%`,
                background:
                  goalPercent >= 100
                    ? 'var(--accent-success)'
                    : 'linear-gradient(90deg, var(--accent-primary), var(--accent-success))',
              }}
            />
          </div>
        </div>

        {/* This Week */}
        <div className="stat-item">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={14} color="var(--accent-success)" />
            <span>This Week</span>
          </div>
          <div className="stat-value">{stats.week.hours}h</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.week.count} {stats.week.count === 1 ? 'task' : 'tasks'} recorded
          </span>
        </div>

        {/* 7-Day Activity Sparkline */}
        <div className="stat-item" style={{ gridColumn: 'span 2' }}>
          <div className="stat-label">Last 7 Days (Activity)</div>
          <div className="sparkline-row">
            {stats.last7Days.map((d, i) => {
              const heightPct = Math.min(100, Math.max(12, Math.round((d.minutes / maxSparkMinutes) * 100)));
              const hours = Math.round((d.minutes / 60) * 10) / 10;
              return (
                <div
                  key={i}
                  className="spark-bar-wrapper"
                  title={`${d.date_str} (${d.day_name}): ${hours}h (${d.count} tasks)`}
                >
                  <div
                    className={`spark-bar ${d.minutes > 0 ? 'has-data' : ''}`}
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="spark-label">{d.day_name.slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
