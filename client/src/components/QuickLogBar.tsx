import React, { useState } from 'react';
import type { Tag, Company, LogStatus } from '../types/index.js';
import { Plus, SlidersHorizontal, CheckCircle2, Clock, AlertTriangle, Building2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuickLogBarProps {
  tags: Tag[];
  companies: Company[];
  onAddLog: (data: {
    title: string;
    status: LogStatus;
    companyId?: number | null;
    tags: string[];
    contentMarkdown?: string;
  }) => Promise<void>;
  onOpenDetailedModal: () => void;
  streakCount: number;
}

export const QuickLogBar: React.FC<QuickLogBarProps> = ({
  tags,
  companies,
  onAddLog,
  onOpenDetailedModal,
}) => {
  const currentCompany = companies.find((c) => c.is_current);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<LogStatus>('done');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    currentCompany ? String(currentCompany.id) : ''
  );
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;

    try {
      setSubmitting(true);
      await onAddLog({
        title: title.trim(),
        status,
        companyId: selectedCompanyId ? Number(selectedCompanyId) : null,
        tags: selectedTags,
      });

      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.7 },
      });

      setTitle('');
      setSelectedTags([]);
    } catch (err: any) {
      alert(err.message || 'Failed to save shift log');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="quick-log-card">
      <form onSubmit={handleQuickSubmit}>
        <div className="quick-log-top">
          <input
            type="text"
            className="quick-log-input"
            placeholder="End-of-shift summary (e.g., Completed release deployment & resolved API incidents #devops)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!title.trim() || submitting}
            title="Log shift work (Enter)"
          >
            <Plus size={16} />
            <span>Log Shift</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenDetailedModal}
            title="Open detailed shift report with markdown & handover notes"
          >
            <SlidersHorizontal size={14} />
            <span>Detailed Entry</span>
          </button>
        </div>

        <div className="quick-log-bottom">
          <div className="quick-controls" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Company Selection Dropdown */}
            {companies.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Building2 size={13} color="var(--accent-primary)" />
                <select
                  className="form-select"
                  style={{ padding: '4px 8px', fontSize: '0.8rem', height: 30 }}
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  title="Assign to company"
                >
                  <option value="">(No Company)</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      🏢 {c.name} {c.is_current ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Shift Status Selector */}
            <div className="pill-group">
              <button
                type="button"
                className={`pill-btn ${status === 'done' ? 'active-done' : ''}`}
                onClick={() => setStatus('done')}
                title="Shift tasks completed successfully"
              >
                <CheckCircle2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                Completed
              </button>
              <button
                type="button"
                className={`pill-btn ${status === 'in_progress' ? 'active-in_progress' : ''}`}
                onClick={() => setStatus('in_progress')}
                title="Work ongoing / Handover for next shift"
              >
                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                In Progress / Handover
              </button>
              <button
                type="button"
                className={`pill-btn ${status === 'blocked' ? 'active-blocked' : ''}`}
                onClick={() => setStatus('blocked')}
                title="Shift encountered blockers"
              >
                <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
                Blocked
              </button>
            </div>
          </div>

          {/* Quick Project/Category Tag Chips */}
          {tags.length > 0 && (
            <div className="filter-chips-row" style={{ gap: '4px' }}>
              {tags.slice(0, 8).map((tag) => {
                const isSelected = selectedTags.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`tag-selector-chip ${isSelected ? 'selected' : ''}`}
                    style={isSelected ? { borderColor: tag.color, color: tag.color } : {}}
                    onClick={() => toggleTag(tag.name)}
                  >
                    #{tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
