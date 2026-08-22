import React from 'react';
import { X, FileText, Table, FileCode, Download } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownload = (format: 'markdown' | 'csv' | 'json') => {
    const link = document.createElement('a');
    link.href = `/api/logs/export/${format}`;
    link.setAttribute('download', `worklog-export.${format === 'markdown' ? 'md' : format}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">📥 Export Work Logs</h2>
          <button className="btn btn-icon btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Choose a format to export your complete work history, status, and notes:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '12px 16px' }}
              onClick={() => handleDownload('markdown')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} color="var(--accent-primary)" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Markdown (.md)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Clean formatted document for Obsidian, Notion, or GitHub
                  </div>
                </div>
              </div>
              <Download size={16} />
            </button>

            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '12px 16px' }}
              onClick={() => handleDownload('csv')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Table size={18} color="var(--accent-success)" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Spreadsheet (.csv)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Compatible with Excel, Google Sheets, and data tools
                  </div>
                </div>
              </div>
              <Download size={16} />
            </button>

            <button
              className="btn btn-secondary"
              style={{ justifyContent: 'space-between', padding: '12px 16px' }}
              onClick={() => handleDownload('json')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileCode size={18} color="var(--accent-warning)" />
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600 }}>Structured JSON (.json)</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Complete raw backup with nested tag associations
                  </div>
                </div>
              </div>
              <Download size={16} />
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
