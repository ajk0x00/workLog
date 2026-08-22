import React from 'react';
import type { FilterState, Tag, Company } from '../types/index.js';
import { Search, X, Check, Clock, AlertCircle } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  tags: Tag[];
  companies: Company[];
  onClearFilters: () => void;
  totalLogs: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  tags,
  companies,
  onClearFilters,
  totalLogs,
}) => {
  const hasActiveFilters =
    filters.search ||
    filters.tag ||
    filters.companyId ||
    filters.status ||
    filters.datePreset !== 'all' ||
    filters.startDate ||
    filters.endDate;

  const datePresets = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
  ] as const;

  const handleDatePreset = (preset: FilterState['datePreset']) => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'all') {
      onFilterChange({ datePreset: 'all', startDate: '', endDate: '' });
    } else if (preset === 'today') {
      onFilterChange({ datePreset: 'today', startDate: todayStr, endDate: todayStr });
    } else if (preset === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split('T')[0];
      onFilterChange({ datePreset: 'yesterday', startDate: yStr, endDate: yStr });
    } else if (preset === 'week') {
      const startOfWeek = new Date(today);
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      startOfWeek.setDate(diff);
      onFilterChange({
        datePreset: 'week',
        startDate: startOfWeek.toISOString().split('T')[0],
        endDate: todayStr,
      });
    } else if (preset === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      onFilterChange({
        datePreset: 'month',
        startDate: startOfMonth.toISOString().split('T')[0],
        endDate: todayStr,
      });
    }
  };

  return (
    <div className="filter-bar">
      <div className="filter-search-row">
        {/* Search Input */}
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search work logs, markdown, tags, blockers..."
            value={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
          />
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClearFilters}
            title="Reset all search filters"
          >
            <X size={14} />
            <span>Reset ({totalLogs} results)</span>
          </button>
        )}
      </div>

      <div className="filter-chips-row">
        {/* Date Range Chips */}
        <div className="pill-group">
          {datePresets.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`pill-btn ${filters.datePreset === p.value ? 'active-done' : ''}`}
              onClick={() => handleDatePreset(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Status Filters */}
        <div className="pill-group">
          <button
            type="button"
            className={`pill-btn ${!filters.status ? 'active-done' : ''}`}
            onClick={() => onFilterChange({ status: '' })}
          >
            All Status
          </button>
          <button
            type="button"
            className={`pill-btn ${filters.status === 'done' ? 'active-done' : ''}`}
            onClick={() => onFilterChange({ status: filters.status === 'done' ? '' : 'done' })}
          >
            <Check size={12} style={{ display: 'inline', marginRight: 3 }} />
            Done
          </button>
          <button
            type="button"
            className={`pill-btn ${filters.status === 'in_progress' ? 'active-in_progress' : ''}`}
            onClick={() =>
              onFilterChange({ status: filters.status === 'in_progress' ? '' : 'in_progress' })
            }
          >
            <Clock size={12} style={{ display: 'inline', marginRight: 3 }} />
            In Progress
          </button>
          <button
            type="button"
            className={`pill-btn ${filters.status === 'blocked' ? 'active-blocked' : ''}`}
            onClick={() =>
              onFilterChange({ status: filters.status === 'blocked' ? '' : 'blocked' })
            }
          >
            <AlertCircle size={12} style={{ display: 'inline', marginRight: 3 }} />
            Blocked
          </button>
        </div>

        {/* Company Filters */}
        {companies.map((c) => {
          const isActive = filters.companyId === String(c.id);
          return (
            <button
              key={c.id}
              type="button"
              className={`filter-chip ${isActive ? 'active' : ''}`}
              onClick={() => onFilterChange({ companyId: isActive ? '' : String(c.id) })}
              style={isActive ? { borderColor: c.color || '#3b82f6', color: c.color || '#3b82f6' } : {}}
            >
              🏢 {c.name} {c.log_count !== undefined ? `(${c.log_count})` : ''}
            </button>
          );
        })}

        {/* Tag Filters */}
        {tags.map((t) => {
          const isActive = filters.tag === t.name;
          return (
            <button
              key={t.id}
              type="button"
              className={`filter-chip ${isActive ? 'active' : ''}`}
              onClick={() => onFilterChange({ tag: isActive ? '' : t.name })}
              style={isActive ? { borderColor: t.color, color: t.color } : {}}
            >
              #{t.name} {t.log_count ? `(${t.log_count})` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
};
