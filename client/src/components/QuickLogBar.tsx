import React, { useState } from 'react';
import type { Tag, LogStatus } from '../types/index.js';
import { Plus, SlidersHorizontal, Check, Clock, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QuickLogBarProps {
  tags: Tag[];
  onAddLog: (data: {
    title: string;
    durationMinutes: number;
    status: LogStatus;
    tags: string[];
    contentMarkdown?: string;
  }) => Promise<void>;
  onOpenDetailedModal: () => void;
  dailyGoalHours: number;
  currentTodayHours: number;
}

export const QuickLogBar: React.FC<QuickLogBarProps> = ({
  tags,
  onAddLog,
  onOpenDetailedModal,
  dailyGoalHours,
  currentTodayHours,
}) => {
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [status, setStatus] = useState<LogStatus>('done');
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
        durationMinutes,
        status,
        tags: selectedTags,
      });

      // If this entry reaches or surpasses the daily goal, fire confetti!
      const newHours = currentTodayHours + durationMinutes / 60;
      if (currentTodayHours < dailyGoalHours && newHours >= dailyGoalHours) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      setTitle('');
      setSelectedTags([]);
    } catch (err: any) {
      alert(err.message || 'Failed to save log');
    } finally {
      setSubmitting(false);
    }
  };

  const durationPresets = [
    { label: '15m', value: 15 },
    { label: '30m', value: 30 },
    { label: '1h', value: 60 },
    { label: '2h', value: 120 },
    { label: '4h', value: 240 },
  ];

  return (
    <div className="quick-log-card">
      <form onSubmit={handleQuickSubmit}>
        <div className="quick-log-top">
          <input
            type="text"
            className="quick-log-input"
            placeholder="What did you work on? (e.g., Implemented auth endpoints #backend)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
          />

          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!title.trim() || submitting}
            title="Log work (Enter)"
          >
            <Plus size={16} />
            <span>Log</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onOpenDetailedModal}
            title="Open full markdown editor"
          >
            <SlidersHorizontal size={14} />
            <span>Details</span>
          </button>
        </div>

        <div className="quick-log-bottom">
          <div className="quick-controls">
            {/* Status Selector Pills */}
            <div className="pill-group">
              <button
                type="button"
                className={`pill-btn ${status === 'done' ? 'active-done' : ''}`}
                onClick={() => setStatus('done')}
              >
                <Check size={12} style={{ display: 'inline', marginRight: 4 }} />
                Done
              </button>
              <button
                type="button"
                className={`pill-btn ${status === 'in_progress' ? 'active-in_progress' : ''}`}
                onClick={() => setStatus('in_progress')}
              >
                <Clock size={12} style={{ display: 'inline', marginRight: 4 }} />
                In Progress
              </button>
              <button
                type="button"
                className={`pill-btn ${status === 'blocked' ? 'active-blocked' : ''}`}
                onClick={() => setStatus('blocked')}
              >
                <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
                Blocked
              </button>
            </div>

            {/* Duration Presets */}
            <div className="pill-group">
              {durationPresets.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`pill-btn ${durationMinutes === d.value ? 'active-done' : ''}`}
                  onClick={() => setDurationMinutes(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Tag Selector Chips */}
          {tags.length > 0 && (
            <div className="filter-chips-row" style={{ gap: '4px' }}>
              {tags.slice(0, 6).map((tag) => {
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
