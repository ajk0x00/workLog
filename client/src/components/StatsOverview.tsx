import React from 'react';
import type { StatsData } from '../types/index.js';
import { Flame, TrendingUp } from 'lucide-react';

interface StatsOverviewProps {
  stats: StatsData | null;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ stats }) => {
  if (!stats) return null;

  const maxSparkCount = Math.max(
    ...stats.last7Days.map((d) => d.count),
    1
  );

  return (
    <div className="stats-card">
      <div className="stats-grid">
        {/* Streak */}
        <div className="stat-item">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Flame size={14} color="#f59e0b" />
            <span>Shift Streak</span>
          </div>
          <div className="stat-value" style={{ color: '#f59e0b' }}>
            {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.streak >= 3 ? '🔥 Consistent end-of-shift logging!' : 'Log at the end of each shift to build streak'}
          </span>
        </div>

        {/* This Week */}
        <div className="stat-item">
          <div className="stat-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={14} color="var(--accent-success)" />
            <span>Shifts This Week</span>
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-success)' }}>
            {stats.week.count} {stats.week.count === 1 ? 'shift' : 'shifts'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.today.count > 0 ? '✓ Shift logged today' : 'Ready for shift-end entry'}
          </span>
        </div>

        {/* 7-Day Activity Sparkline */}
        <div className="stat-item" style={{ gridColumn: 'span 2' }}>
          <div className="stat-label">Last 7 Days (Shift Logs)</div>
          <div className="sparkline-row">
            {stats.last7Days.map((d, i) => {
              const heightPct = d.count > 0 ? Math.min(100, Math.max(30, Math.round((d.count / maxSparkCount) * 100))) : 12;
              return (
                <div
                  key={i}
                  className="spark-bar-wrapper"
                  title={`${d.date_str} (${d.day_name}): ${d.count} shift entries logged`}
                >
                  <div
                    className={`spark-bar ${d.count > 0 ? 'has-data' : ''}`}
                    style={{
                      height: `${heightPct}%`,
                      background: d.count > 0 ? 'linear-gradient(180deg, var(--accent-primary), var(--accent-success))' : undefined,
                    }}
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
