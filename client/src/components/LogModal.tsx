import React, { useState, useEffect } from 'react';
import type { WorkLog, Tag, LogStatus } from '../types/index.js';
import { X, Plus, Eye, Code } from 'lucide-react';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: number;
    title: string;
    logDate: string;
    contentMarkdown: string;
    durationMinutes: number;
    status: LogStatus;
    blockers: string;
    achievements: string;
    tags: string[];
  }) => Promise<void>;
  initialLog?: WorkLog | null;
  allTags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag>;
}

export const LogModal: React.FC<LogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialLog,
  allTags,
  onCreateTag,
}) => {
  const [title, setTitle] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [status, setStatus] = useState<LogStatus>('done');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [blockers, setBlockers] = useState('');
  const [achievements, setAchievements] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [showTagCreator, setShowTagCreator] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialLog) {
      setTitle(initialLog.title);
      setLogDate(initialLog.log_date || new Date().toISOString().split('T')[0]);
      setDurationMinutes(initialLog.duration_minutes || 60);
      setStatus(initialLog.status || 'done');
      setContentMarkdown(initialLog.content_markdown || '');
      setBlockers(initialLog.blockers || '');
      setAchievements(initialLog.achievements || '');
      setSelectedTags((initialLog.tags || []).map((t) => t.name));
    } else {
      setTitle('');
      setLogDate(new Date().toISOString().split('T')[0]);
      setDurationMinutes(60);
      setStatus('done');
      setContentMarkdown('');
      setBlockers('');
      setAchievements('');
      setSelectedTags([]);
    }
  }, [initialLog, isOpen]);

  if (!isOpen) return null;

  const toggleTag = (tagName: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagName) ? prev.filter((t) => t !== tagName) : [...prev, tagName]
    );
  };

  const handleCreateNewTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;
    try {
      const tag = await onCreateTag(newTagName.trim(), newTagColor);
      setSelectedTags((prev) => [...prev, tag.name]);
      setNewTagName('');
      setShowTagCreator(false);
    } catch (err: any) {
      alert(err.message || 'Failed to create tag');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    try {
      setSaving(true);
      await onSave({
        id: initialLog?.id,
        title: title.trim(),
        logDate,
        contentMarkdown,
        durationMinutes,
        status,
        blockers,
        achievements,
        tags: selectedTags,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save log');
    } finally {
      setSaving(false);
    }
  };

  const insertTaskSnippet = () => {
    setContentMarkdown((prev) => `${prev ? prev + '\n' : ''}- [ ] New task item`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{initialLog ? 'Edit Work Log' : 'Create Detailed Work Log'}</h2>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Title */}
            <div className="form-group">
              <label className="form-label">Work Title *</label>
              <input
                type="text"
                className="form-input"
                placeholder="E.g., Finished PostgreSQL migration & refactored queries"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Date, Duration, Status Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Duration (Minutes)</label>
                <input
                  type="number"
                  min="0"
                  step="15"
                  className="form-input"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value || '0', 10))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LogStatus)}
                >
                  <option value="done">✅ Done</option>
                  <option value="in_progress">⏳ In Progress</option>
                  <option value="blocked">🛑 Blocked</option>
                </select>
              </div>
            </div>

            {/* Tags Selection & Quick Creator */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Tags / Categories</label>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                  onClick={() => setShowTagCreator(!showTagCreator)}
                >
                  <Plus size={12} /> {showTagCreator ? 'Cancel' : 'New Tag'}
                </button>
              </div>

              {showTagCreator && (
                <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tag name (e.g. devops)"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="color"
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    style={{ width: 38, height: 38, padding: 2, borderRadius: 6, cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleCreateNewTag}
                  >
                    Add
                  </button>
                </div>
              )}

              <div className="filter-chips-row" style={{ marginTop: 6 }}>
                {allTags.map((t) => {
                  const isSelected = selectedTags.includes(t.name);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      className={`tag-selector-chip ${isSelected ? 'selected' : ''}`}
                      style={isSelected ? { borderColor: t.color, color: t.color } : {}}
                      onClick={() => toggleTag(t.name)}
                    >
                      #{t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Markdown Editor & Preview */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Notes & Checklist (Markdown)</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={insertTaskSnippet}
                    title="Insert task checkbox"
                  >
                    + Checkbox
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeTab === 'write' ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('write')}
                  >
                    <Code size={12} /> Write
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${activeTab === 'preview' ? 'btn-secondary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('preview')}
                  >
                    <Eye size={12} /> Preview
                  </button>
                </div>
              </div>

              {activeTab === 'write' ? (
                <textarea
                  className="form-textarea"
                  rows={5}
                  placeholder={`- [x] Tested PostgreSQL pool failover\n- [ ] Write integration test for standup endpoint\n\n### Implementation details\nAdded retry logic and optimized indexes.`}
                  value={contentMarkdown}
                  onChange={(e) => setContentMarkdown(e.target.value)}
                />
              ) : (
                <div
                  className="log-markdown-body"
                  style={{
                    background: 'var(--bg-input)',
                    padding: 12,
                    borderRadius: 'var(--radius-md)',
                    minHeight: 110,
                  }}
                >
                  {contentMarkdown ? (
                    contentMarkdown.split('\n').map((line, i) => <p key={i}>{line}</p>)
                  ) : (
                    <span style={{ color: 'var(--text-muted)' }}>Nothing to preview</span>
                  )}
                </div>
              )}
            </div>

            {/* Blockers & Achievements */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Blockers (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="E.g. Waiting on API credentials"
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Achievements (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="E.g. Shipped v1 to staging!"
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim() || saving}>
              {saving ? 'Saving...' : initialLog ? 'Update Log' : 'Save Work Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
