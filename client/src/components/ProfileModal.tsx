import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { X, Save, User as UserIcon } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [dailyGoalHours, setDailyGoalHours] = useState(user?.daily_goal_hours || 8);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfile({
        full_name: fullName.trim(),
        daily_goal_hours: dailyGoalHours,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserIcon size={18} color="var(--accent-primary)" />
            <h2 className="modal-title">Profile & Work Preferences</h2>
          </div>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
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

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="text"
                className="form-input"
                value={user.email}
                disabled
                style={{ opacity: 0.7 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                className="form-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your display name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Daily Work Goal (Hours)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="24"
                className="form-input"
                value={dailyGoalHours}
                onChange={(e) => setDailyGoalHours(parseFloat(e.target.value || '8'))}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Target hours per day to track against in your progress meters.
              </span>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
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
