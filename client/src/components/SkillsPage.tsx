import React, { useState } from 'react';
import type { Skill } from '../types/index.js';
import {
  Star,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  Award,
  Sparkles,
  Layers,
  Zap,
  X,
} from 'lucide-react';

interface SkillsPageProps {
  skills: Skill[];
  onCreateSkill: (data: {
    name: string;
    category: string;
    proficiency: number;
    yearsExperience: number;
    lastUsedAt?: string;
    isActive?: boolean;
  }) => Promise<Skill>;
  onUpdateSkill: (id: number, data: Partial<Skill>) => Promise<Skill>;
  onDeleteSkill: (id: number) => Promise<void>;
}

const CATEGORY_PRESETS = [
  'All',
  '⚡ Actively Using',
  'Frontend',
  'Backend',
  'DevOps & Cloud',
  'Databases',
  'Languages',
  'AI / ML',
  'Tools & Frameworks',
  'General',
];

const PROFICIENCY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Elementary',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert / Master',
};

export const SkillsPage: React.FC<SkillsPageProps> = ({
  skills,
  onCreateSkill,
  onUpdateSkill,
  onDeleteSkill,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Frontend');
  const [proficiency, setProficiency] = useState(3);
  const [yearsExperience, setYearsExperience] = useState(1.0);
  const [lastUsedAt, setLastUsedAt] = useState(new Date().toISOString().split('T')[0]);
  const [isActive, setIsActive] = useState(true);
  const [hoverStar, setHoverStar] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Compute Metrics
  const totalSkills = skills.length;
  const activeSkillsCount = skills.filter((s) => s.is_active).length;
  const masteredSkills = skills.filter((s) => s.proficiency === 5).length;
  const avgRating =
    totalSkills > 0
      ? (skills.reduce((acc, s) => acc + s.proficiency, 0) / totalSkills).toFixed(1)
      : '0.0';

  // Calculate skills needing brush up (last used > 180 days ago)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setDate(sixMonthsAgo.getDate() - 180);
  const brushUpCount = skills.filter((s) => {
    if (!s.last_used_at) return false;
    return new Date(s.last_used_at) < sixMonthsAgo;
  }).length;

  const openCreateModal = () => {
    setEditingSkill(null);
    setName('');
    setCategory('Frontend');
    setProficiency(3);
    setYearsExperience(1.0);
    setLastUsedAt(new Date().toISOString().split('T')[0]);
    setIsActive(true);
    setShowModal(true);
  };

  const openEditModal = (s: Skill) => {
    setEditingSkill(s);
    setName(s.name);
    setCategory(s.category || 'General');
    setProficiency(s.proficiency);
    setYearsExperience(s.years_experience);
    setLastUsedAt(s.last_used_at || new Date().toISOString().split('T')[0]);
    setIsActive(s.is_active !== undefined ? s.is_active : true);
    setShowModal(true);
  };

  const handleSaveSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    try {
      setSaving(true);
      if (editingSkill) {
        await onUpdateSkill(editingSkill.id, {
          name: name.trim(),
          category: category.trim(),
          proficiency,
          years_experience: yearsExperience,
          last_used_at: lastUsedAt,
          is_active: isActive,
        });
      } else {
        await onCreateSkill({
          name: name.trim(),
          category: category.trim(),
          proficiency,
          yearsExperience,
          lastUsedAt,
          isActive,
        });
      }
      setShowModal(false);
    } catch (err: any) {
      alert(err.message || 'Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  const handleQuickRating = async (skill: Skill, newRating: number) => {
    try {
      await onUpdateSkill(skill.id, { proficiency: newRating });
    } catch (err: any) {
      console.error('Failed to update rating:', err);
    }
  };

  const handleToggleActive = async (skill: Skill) => {
    try {
      await onUpdateSkill(skill.id, { is_active: !skill.is_active });
    } catch (err: any) {
      console.error('Failed to toggle active status:', err);
    }
  };

  const handleDelete = async (s: Skill) => {
    if (window.confirm(`Delete skill "${s.name}" from your matrix?`)) {
      try {
        await onDeleteSkill(s.id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete skill');
      }
    }
  };

  // Filter skills
  const filteredSkills = skills.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase());
    
    let matchesCategory = true;
    if (selectedCategory === '⚡ Actively Using') {
      matchesCategory = s.is_active;
    } else if (selectedCategory !== 'All') {
      matchesCategory = s.category.toLowerCase() === selectedCategory.toLowerCase();
    }

    return matchesSearch && matchesCategory;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={22} color="var(--accent-primary)" />
            Technical Skills & Proficiency Matrix
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
            Track active tech stack, mastery level, experience, and flag skills that need brush-ups.
          </p>
        </div>

        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          <span>Add Skill</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="stats-overview-grid">
        <div className="stat-card">
          <div className="stat-label">
            <Layers size={14} /> Total Skills
          </div>
          <div className="stat-value">{totalSkills}</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Zap size={14} color="var(--accent-primary)" /> Actively Using
          </div>
          <div className="stat-value" style={{ color: 'var(--accent-primary)' }}>
            {activeSkillsCount}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Award size={14} color="#eab308" /> Mastered (5★)
          </div>
          <div className="stat-value" style={{ color: '#eab308' }}>
            {masteredSkills}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <Star size={14} color="#f59e0b" /> Avg Rating
          </div>
          <div className="stat-value">{avgRating} ★</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">
            <AlertCircle size={14} color={brushUpCount > 0 ? '#f97316' : 'var(--text-muted)'} /> Needs Brush Up
          </div>
          <div className="stat-value" style={brushUpCount > 0 ? { color: '#f97316' } : {}}>
            {brushUpCount} {brushUpCount === 1 ? 'skill' : 'skills'}
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="filter-bar">
        <div className="filter-search-row">
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search skills (e.g. React, PostgreSQL, Docker)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-chips-row">
          {CATEGORY_PRESETS.map((cat) => {
            const isActiveCategory = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                className={`filter-chip ${isActiveCategory ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skills Grid */}
      {filteredSkills.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 24px' }}>
          <Sparkles className="empty-icon" />
          <div className="empty-title">No skills match your search</div>
          <div className="empty-desc">
            {skills.length === 0
              ? 'Start building your tech matrix by adding your first skill.'
              : 'Try clearing your search query or selecting another category.'}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
            <Plus size={14} /> Add First Skill
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filteredSkills.map((s) => {
            const isOutdated = s.last_used_at && new Date(s.last_used_at) < sixMonthsAgo;
            return (
              <div
                key={s.id}
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${s.is_active ? 'var(--accent-primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: 'var(--shadow-sm)',
                  position: 'relative',
                  opacity: s.is_active ? 1 : 0.75,
                }}
              >
                {/* Header: Skill Name, Category & Active Badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{s.name}</h3>
                      {/* Active Status Badge / Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggleActive(s)}
                        style={{
                          background: s.is_active ? 'var(--accent-primary)' : 'var(--bg-input)',
                          color: s.is_active ? '#fff' : 'var(--text-muted)',
                          border: 'none',
                          borderRadius: 12,
                          padding: '1px 7px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          transition: 'all 0.2s ease',
                        }}
                        title={s.is_active ? 'Actively using (Click to mark inactive)' : 'Inactive / Inactive stack (Click to activate)'}
                      >
                        <Zap size={10} />
                        {s.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </div>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        background: 'var(--bg-input)',
                        color: 'var(--text-muted)',
                        padding: '2px 8px',
                        borderRadius: 10,
                        display: 'inline-block',
                        marginTop: 6,
                      }}
                    >
                      {s.category}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="btn btn-icon btn-sm"
                      onClick={() => openEditModal(s)}
                      title="Edit skill details"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      className="btn btn-icon btn-sm btn-danger-ghost"
                      onClick={() => handleDelete(s)}
                      title="Delete skill"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Star Rating System */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isFilled = star <= s.proficiency;
                      return (
                        <span
                          key={star}
                          title={`Set rating to ${star} star (${PROFICIENCY_LABELS[star]})`}
                          onClick={() => handleQuickRating(s, star)}
                          style={{ cursor: 'pointer', display: 'inline-flex' }}
                        >
                          <Star
                            size={18}
                            style={{ transition: 'transform 0.15s ease' }}
                            color={isFilled ? '#f59e0b' : 'var(--border)'}
                            fill={isFilled ? '#f59e0b' : 'none'}
                          />
                        </span>
                      );
                    })}
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: 6, fontWeight: 500 }}>
                      {PROFICIENCY_LABELS[s.proficiency]}
                    </span>
                  </div>
                </div>

                {/* Bottom Stats: Years & Last Used */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border)',
                    paddingTop: 10,
                    marginTop: 'auto',
                  }}
                >
                  <span>⏱️ {s.years_experience} {s.years_experience === 1 ? 'year' : 'years'} exp</span>

                  {s.last_used_at && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: isOutdated ? '#f97316' : 'var(--text-muted)',
                        fontWeight: isOutdated ? 600 : 400,
                      }}
                      title={isOutdated ? 'Needs brush-up! Not used in over 6 months' : `Last used: ${s.last_used_at}`}
                    >
                      {isOutdated && <AlertCircle size={12} />}
                      Used: {s.last_used_at}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Skill Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingSkill ? 'Edit Skill Details' : 'Add New Skill to Matrix'}</h2>
              <button className="btn btn-icon btn-sm" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSkill}>
              <div className="modal-body">
                {/* Skill Name */}
                <div className="form-group">
                  <label className="form-label">Skill / Technology Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="E.g., React, PostgreSQL, Docker, Python, Go"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                {/* Category & Experience */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="form-select"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="Frontend">Frontend</option>
                      <option value="Backend">Backend</option>
                      <option value="DevOps & Cloud">DevOps & Cloud</option>
                      <option value="Databases">Databases</option>
                      <option value="Languages">Languages</option>
                      <option value="AI / ML">AI / ML</option>
                      <option value="Tools & Frameworks">Tools & Frameworks</option>
                      <option value="General">General</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Years of Experience</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="50"
                      className="form-input"
                      value={yearsExperience}
                      onChange={(e) => setYearsExperience(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Star Rating Picker */}
                <div className="form-group">
                  <label className="form-label">Proficiency Rating (1 to 5 Stars)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const displayFilled = (hoverStar !== null ? hoverStar : proficiency) >= star;
                      return (
                        <Star
                          key={star}
                          size={26}
                          style={{ cursor: 'pointer', transition: 'transform 0.1s ease' }}
                          color={displayFilled ? '#f59e0b' : 'var(--border)'}
                          fill={displayFilled ? '#f59e0b' : 'none'}
                          onMouseEnter={() => setHoverStar(star)}
                          onMouseLeave={() => setHoverStar(null)}
                          onClick={() => setProficiency(star)}
                        />
                      );
                    })}
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent-primary)', marginLeft: 8 }}>
                      {PROFICIENCY_LABELS[hoverStar !== null ? hoverStar : proficiency]}
                    </span>
                  </div>
                </div>

                {/* Last Used At & Is Active Checkbox */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Last Used Date</label>
                    <input
                      type="date"
                      className="form-input"
                      value={lastUsedAt}
                      onChange={(e) => setLastUsedAt(e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: 22 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <span>⚡ Actively Using</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={!name.trim() || saving}>
                  {saving ? 'Saving...' : editingSkill ? 'Update Skill' : 'Add Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
