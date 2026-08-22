import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import type { Company } from '../types/index.js';
import { X, Save, User as UserIcon, Building2, Plus, Trash2, CheckCircle2, Edit2 } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  companies: Company[];
  onCreateCompany: (name: string, color: string, isCurrent: boolean) => Promise<Company>;
  onUpdateCompany: (id: number, data: Partial<Company>) => Promise<Company>;
  onDeleteCompany: (id: number) => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  companies,
  onCreateCompany,
  onUpdateCompany,
  onDeleteCompany,
}) => {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [saving, setSaving] = useState(false);

  // New/Edit Company Form State
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [compName, setCompName] = useState('');
  const [compColor, setCompColor] = useState('#3b82f6');
  const [compIsCurrent, setCompIsCurrent] = useState(true);
  const [compSaving, setCompSaving] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({
        full_name: fullName.trim(),
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenNewCompany = () => {
    setEditingCompanyId(null);
    setCompName('');
    setCompColor('#3b82f6');
    setCompIsCurrent(companies.length === 0);
    setShowCompanyForm(true);
  };

  const handleOpenEditCompany = (c: Company) => {
    setEditingCompanyId(c.id);
    setCompName(c.name);
    setCompColor(c.color || '#3b82f6');
    setCompIsCurrent(c.is_current);
    setShowCompanyForm(true);
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!compName.trim() || compSaving) return;

    try {
      setCompSaving(true);
      if (editingCompanyId) {
        await onUpdateCompany(editingCompanyId, {
          name: compName.trim(),
          color: compColor,
          is_current: compIsCurrent,
        });
      } else {
        await onCreateCompany(compName.trim(), compColor, compIsCurrent);
      }
      setShowCompanyForm(false);
      setCompName('');
    } catch (err: any) {
      alert(err.message || 'Failed to save company');
    } finally {
      setCompSaving(false);
    }
  };

  const handleDeleteCompany = async (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete company "${name}"? Work logs linked to it will be unassigned.`)) {
      try {
        await onDeleteCompany(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete company');
      }
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserIcon size={18} color="var(--accent-primary)" />
            <h2 className="modal-title">Profile & Work Preferences</h2>
          </div>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmitProfile}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Account Info */}
            <div>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  value={user.username}
                  disabled
                  style={{ opacity: 0.7 }}
                />
              </div>

              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">Email</label>
                <input
                  type="text"
                  className="form-input"
                  value={user.email}
                  disabled
                  style={{ opacity: 0.7 }}
                />
              </div>

              <div className="form-group" style={{ marginTop: 10 }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your display name"
                />
              </div>
            </div>

            <hr style={{ borderColor: 'var(--border)', opacity: 0.4 }} />

            {/* Companies & Employers Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Building2 size={16} color="var(--accent-primary)" />
                  <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Companies & Employers</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem' }}
                  onClick={handleOpenNewCompany}
                >
                  <Plus size={12} /> Add Company
                </button>
              </div>

              {/* Company Form */}
              {showCompanyForm && (
                <div
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                    marginBottom: 12,
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
                    {editingCompanyId ? 'Edit Company' : 'Add New Company'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Company Name (e.g. Glowing, QBurst)"
                        value={compName}
                        onChange={(e) => setCompName(e.target.value)}
                        autoFocus
                        required
                      />
                      <input
                        type="color"
                        value={compColor}
                        onChange={(e) => setCompColor(e.target.value)}
                        style={{ width: 38, height: 38, padding: 2, borderRadius: 6, cursor: 'pointer' }}
                        title="Pick company badge color"
                      />
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={compIsCurrent}
                        onChange={(e) => setCompIsCurrent(e.target.checked)}
                      />
                      <span>Set as Current Employer</span>
                    </label>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowCompanyForm(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!compName.trim() || compSaving}
                        onClick={handleSaveCompany}
                      >
                        {compSaving ? 'Saving...' : editingCompanyId ? 'Update' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Companies List */}
              {companies.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No companies added yet. Click "+ Add Company" above to add employers (e.g., Glowing, QBurst).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {companies.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        background: 'var(--bg-input)',
                        borderRadius: 'var(--radius-md)',
                        borderLeft: `4px solid ${c.color || '#3b82f6'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.name}</span>
                        {c.is_current && (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              background: 'var(--accent-primary)',
                              color: '#fff',
                              padding: '1px 6px',
                              borderRadius: 10,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            <CheckCircle2 size={10} /> Current
                          </span>
                        )}
                        {c.log_count !== undefined && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ({c.log_count} {c.log_count === 1 ? 'log' : 'logs'})
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="btn btn-icon btn-sm"
                          onClick={() => handleOpenEditCompany(c)}
                          title="Edit company"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-icon btn-sm btn-danger-ghost"
                          onClick={() => handleDeleteCompany(c.id, c.name)}
                          title="Delete company"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={15} />
              <span>{saving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
