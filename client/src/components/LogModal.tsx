import React, { useState, useEffect } from 'react';
import type { WorkLog, Tag, Company, Skill, LogStatus } from '../types/index.js';
import { X, Plus, Eye, Code, AlertTriangle, ArrowRightCircle, Building2, Star, Sparkles } from 'lucide-react';

interface LogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    id?: number;
    title: string;
    logDate: string;
    contentMarkdown: string;
    status: LogStatus;
    blockers: string;
    achievements: string;
    companyId?: number | null;
    tags: string[];
  }) => Promise<void>;
  initialLog?: WorkLog | null;
  allTags: Tag[];
  companies: Company[];
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  onCreateSkill?: (data: {
    name: string;
    category: string;
    proficiency: number;
    yearsExperience: number;
    lastUsedAt?: string;
  }) => Promise<Skill>;
}

export const LogModal: React.FC<LogModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialLog,
  allTags,
  companies,
  onCreateTag,
  onCreateSkill,
}) => {
  const [title, setTitle] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState<LogStatus>('done');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [blockers, setBlockers] = useState('');
  const [achievements, setAchievements] = useState('');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6366f1');
  const [showTagCreator, setShowTagCreator] = useState(false);
  
  // Quick Skill Creator state inside Work Log Modal
  const [showSkillCreator, setShowSkillCreator] = useState(false);
  const [quickSkillName, setQuickSkillName] = useState('');
  const [quickSkillCategory, setQuickSkillCategory] = useState('Frontend');
  const [quickSkillStars, setQuickSkillStars] = useState(3);
  const [quickSkillSaving, setQuickSkillSaving] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const currentComp = companies.find((c) => c.is_current);
    if (initialLog) {
      setTitle(initialLog.title);
      setLogDate(initialLog.log_date || new Date().toISOString().split('T')[0]);
      setStatus(initialLog.status || 'done');
      setContentMarkdown(initialLog.content_markdown || '');
      setBlockers(initialLog.blockers || '');
      setAchievements(initialLog.achievements || '');
      setSelectedCompanyId(
        initialLog.company_id ? String(initialLog.company_id) : currentComp ? String(currentComp.id) : ''
      );
      setSelectedTags((initialLog.tags || []).map((t) => t.name));
    } else {
      setTitle('');
      setLogDate(new Date().toISOString().split('T')[0]);
      setStatus('done');
      setContentMarkdown('');
      setBlockers('');
      setAchievements('');
      setSelectedCompanyId(currentComp ? String(currentComp.id) : '');
      setSelectedTags([]);
    }
  }, [initialLog, isOpen, companies]);

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
        status,
        blockers,
        achievements,
        companyId: selectedCompanyId ? Number(selectedCompanyId) : null,
        tags: selectedTags,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save shift log');
    } finally {
      setSaving(false);
    }
  };

  const insertTaskSnippet = () => {
    setContentMarkdown((prev) => `${prev ? prev + '\n' : ''}- [x] Completed task item\n- [ ] Handover / pending item`);
  };

  const handleCreateQuickSkill = async () => {
    if (!quickSkillName.trim() || !onCreateSkill || quickSkillSaving) return;
    try {
      setQuickSkillSaving(true);
      await onCreateSkill({
        name: quickSkillName.trim(),
        category: quickSkillCategory,
        proficiency: quickSkillStars,
        yearsExperience: 1.0,
        lastUsedAt: logDate,
      });
      setQuickSkillName('');
      setShowSkillCreator(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add skill');
    } finally {
      setQuickSkillSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 660 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{initialLog ? 'Edit Shift Work Details' : 'End-of-Shift Work Details'}</h2>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Shift Title / Summary */}
            <div className="form-group">
              <label className="form-label">Shift Summary / Headline *</label>
              <input
                type="text"
                className="form-input"
                placeholder="E.g., Deployed v2 release, resolved staging incident & updated docs"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Company, Shift Date & Status */}
            <div style={{ display: 'grid', gridTemplateColumns: companies.length > 0 ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12 }}>
              {companies.length > 0 && (
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Building2 size={13} color="var(--accent-primary)" />
                    <span>Company / Employer</span>
                  </label>
                  <select
                    className="form-select"
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                  >
                    <option value="">(None / Personal)</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        🏢 {c.name} {c.is_current ? '(Current)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Shift Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Shift Outcome / Status</label>
                <select
                  className="form-select"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LogStatus)}
                >
                  <option value="done">✅ Shift Completed</option>
                  <option value="in_progress">⏳ In Progress / Handover</option>
                  <option value="blocked">🛑 Blocked</option>
                </select>
              </div>
            </div>

            {/* Tags & Quick Skill Creator Controls */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Projects & Categories</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {onCreateSkill && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '0.75rem', padding: '2px 6px', color: '#eab308' }}
                      onClick={() => {
                        setShowSkillCreator(!showSkillCreator);
                        setShowTagCreator(false);
                      }}
                    >
                      <Sparkles size={12} /> {showSkillCreator ? 'Cancel Skill' : '+ Add Skill to Matrix'}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={() => {
                      setShowTagCreator(!showTagCreator);
                      setShowSkillCreator(false);
                    }}
                  >
                    <Plus size={12} /> {showTagCreator ? 'Cancel Tag' : 'New Project Tag'}
                  </button>
                </div>
              </div>

              {/* Quick Skill Creator Form */}
              {showSkillCreator && (
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px dashed #eab308',
                    borderRadius: 'var(--radius-md)',
                    padding: 10,
                    marginTop: 6,
                    marginBottom: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#eab308', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Sparkles size={13} /> Add Skill & Rate Proficiency
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Skill name (e.g. Next.js, Kubernetes)"
                      value={quickSkillName}
                      onChange={(e) => setQuickSkillName(e.target.value)}
                      style={{ flex: 2, minWidth: 140 }}
                    />

                    <select
                      className="form-select"
                      value={quickSkillCategory}
                      onChange={(e) => setQuickSkillCategory(e.target.value)}
                      style={{ flex: 1, minWidth: 120 }}
                    >
                      <option value="Frontend">Frontend</option>
                      <option value="Backend">Backend</option>
                      <option value="DevOps & Cloud">DevOps & Cloud</option>
                      <option value="Databases">Databases</option>
                      <option value="Languages">Languages</option>
                      <option value="Tools & Frameworks">Tools</option>
                    </select>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={18}
                          style={{ cursor: 'pointer' }}
                          color={star <= quickSkillStars ? '#f59e0b' : 'var(--border)'}
                          fill={star <= quickSkillStars ? '#f59e0b' : 'none'}
                          onClick={() => setQuickSkillStars(star)}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleCreateQuickSkill}
                      disabled={!quickSkillName.trim() || quickSkillSaving}
                    >
                      {quickSkillSaving ? 'Saving...' : 'Add Skill'}
                    </button>
                  </div>
                </div>
              )}

              {showTagCreator && (
                <div style={{ display: 'flex', gap: 8, marginTop: 6, marginBottom: 8 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Project tag (e.g., billing)"
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

            {/* Markdown Work Checklist & Details */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label">Detailed Work & Task Checklist (Markdown)</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '0.75rem', padding: '2px 6px' }}
                    onClick={insertTaskSnippet}
                    title="Insert checklist template"
                  >
                    + Checklists
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
                  rows={6}
                  placeholder={`- [x] Merged pull request #409 for PostgreSQL migrations\n- [x] Verified zero downtime in staging\n- [ ] Handover: monitor pod memory during peak hours\n\n### Highlights\nResolved auth cookie compatibility over plain HTTP.`}
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
                    minHeight: 130,
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

            {/* Handover & Blockers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <ArrowRightCircle size={13} color="var(--accent-primary)" />
                  <span>Handover / Next Shift Notes (Optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="E.g., Review PR #12 and check test run"
                  value={achievements}
                  onChange={(e) => setAchievements(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={13} color="var(--accent-danger)" />
                  <span>Blockers / Escalations (Optional)</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="E.g., Blocked on AWS IAM permissions"
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!title.trim() || saving}>
              {saving ? 'Saving...' : initialLog ? 'Update Shift Entry' : 'Save Shift Work Details'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
