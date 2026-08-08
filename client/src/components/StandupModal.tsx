import React, { useState, useEffect } from 'react';
import { api } from '../utils/api.js';
import { X, Copy, Check, Calendar, RefreshCw } from 'lucide-react';

interface StandupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StandupModal: React.FC<StandupModalProps> = ({ isOpen, onClose }) => {
  const [standupText, setStandupText] = useState('');
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<{ todayCount: number; prevCount: number; blockersCount: number } | null>(null);

  const fetchStandup = async (dateStr: string) => {
    try {
      setLoading(true);
      const res = await api.post<{
        markdown: string;
        todayCount: number;
        prevCount: number;
        blockersCount: number;
      }>('/api/logs/standup/generate', { targetDate: dateStr });
      setStandupText(res.markdown);
      setStats({
        todayCount: res.todayCount,
        prevCount: res.prevCount,
        blockersCount: res.blockersCount,
      });
    } catch (err: any) {
      alert(err.message || 'Failed to generate standup');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStandup(targetDate);
    }
  }, [isOpen, targetDate]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(standupText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="modal-title">📋 Daily Standup Summary</h2>
          </div>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={15} color="var(--text-muted)" />
              <label className="form-label" style={{ margin: 0 }}>Target Date:</label>
              <input
                type="date"
                className="form-input"
                style={{ padding: '4px 8px', fontSize: '0.825rem' }}
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fetchStandup(targetDate)}
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>Regenerate</span>
            </button>
          </div>

          {stats && (
            <div style={{ display: 'flex', gap: 12, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Previous day logs: <strong>{stats.prevCount}</strong></span>
              <span>•</span>
              <span>Today items: <strong>{stats.todayCount}</strong></span>
              <span>•</span>
              <span>Active blockers: <strong>{stats.blockersCount}</strong></span>
            </div>
          )}

          <div className="form-group">
            <textarea
              className="form-textarea"
              style={{ minHeight: 240, fontFamily: 'var(--font-mono)', fontSize: '0.825rem' }}
              value={standupText}
              onChange={(e) => setStandupText(e.target.value)}
              placeholder="Standup summary is generating..."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCopy}
            disabled={!standupText}
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy for Slack / Teams</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
