import React, { useState } from 'react';
import type { WorkLog, LogStatus } from '../types/index.js';
import {
  Clock,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Award,
} from 'lucide-react';

interface LogCardProps {
  log: WorkLog;
  onEdit: (log: WorkLog) => void;
  onDelete: (id: number) => Promise<void>;
  onStatusChange: (id: number, status: LogStatus) => Promise<void>;
  onUpdateContent?: (id: number, newMarkdown: string) => Promise<void>;
}

export const LogCard: React.FC<LogCardProps> = ({
  log,
  onEdit,
  onDelete,
  onStatusChange,
  onUpdateContent,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const durationHours = Math.round((log.duration_minutes / 60) * 10) / 10;

  const cycleStatus = async () => {
    const nextStatus: Record<LogStatus, LogStatus> = {
      done: 'in_progress',
      in_progress: 'blocked',
      blocked: 'done',
    };
    await onStatusChange(log.id, nextStatus[log.status]);
  };

  const handleDelete = async () => {
    if (window.confirm(`Delete log "${log.title}"?`)) {
      try {
        setDeleting(true);
        await onDelete(log.id);
      } finally {
        setDeleting(false);
      }
    }
  };

  // Helper to toggle task list checkbox in markdown content directly
  const handleToggleTask = async (taskIndex: number, currentChecked: boolean) => {
    if (!onUpdateContent) return;

    let currentIndex = 0;
    const lines = (log.content_markdown || '').split('\n');
    const updatedLines = lines.map((line) => {
      const taskMatch = line.match(/^(\s*[-*]\s*\[)([ xX])(\]\s*.*)$/);
      if (taskMatch) {
        if (currentIndex === taskIndex) {
          const newBox = currentChecked ? ' ' : 'x';
          currentIndex++;
          return `${taskMatch[1]}${newBox}${taskMatch[3]}`;
        }
        currentIndex++;
      }
      return line;
    });

    const newMarkdown = updatedLines.join('\n');
    await onUpdateContent(log.id, newMarkdown);
  };

  // Simple, safe Markdown parser with task list checkboxes and syntax formatting
  const renderMarkdown = (content: string) => {
    if (!content || !content.trim()) return null;

    const lines = content.split('\n');
    let taskCounter = 0;

    return (
      <div className="log-markdown-body">
        {lines.map((line, idx) => {
          // Task checkbox: - [ ] or - [x]
          const taskMatch = line.match(/^(\s*[-*]\s*\[)([ xX])(\]\s*)(.*)$/);
          if (taskMatch) {
            const isChecked = taskMatch[2].toLowerCase() === 'x';
            const currentTaskIdx = taskCounter++;
            return (
              <div key={idx} className="task-list-item">
                <input
                  type="checkbox"
                  className="task-checkbox"
                  checked={isChecked}
                  onChange={() => handleToggleTask(currentTaskIdx, isChecked)}
                />
                <span style={isChecked ? { textDecoration: 'line-through', opacity: 0.7 } : {}}>
                  {taskMatch[4]}
                </span>
              </div>
            );
          }

          // Header ###
          if (line.startsWith('### ')) {
            return <h3 key={idx}>{line.replace('### ', '')}</h3>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={idx}>{line.replace('## ', '')}</h2>;
          }
          if (line.startsWith('# ')) {
            return <h1 key={idx}>{line.replace('# ', '')}</h1>;
          }

          // Bullet
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={idx} style={{ marginLeft: 16 }}>
                {line.substring(2)}
              </li>
            );
          }

          // Code block
          if (line.startsWith('```')) {
            return null;
          }

          // Regular paragraph
          if (!line.trim()) {
            return <div key={idx} style={{ height: 6 }} />;
          }

          return <p key={idx}>{line}</p>;
        })}
      </div>
    );
  };

  return (
    <div className={`log-card status-${log.status}`}>
      <div className="log-card-header">
        <div
          className={`log-status-dot ${log.status}`}
          onClick={cycleStatus}
          style={{ cursor: 'pointer' }}
          title={`Status: ${log.status.replace('_', ' ')} (Click to toggle)`}
        />

        <div className="log-title-area">
          <div className="log-title">{log.title}</div>

          <div className="log-card-meta">
            {durationHours > 0 && (
              <span className="duration-pill">
                <Clock size={11} />
                {durationHours}h
              </span>
            )}

            {/* Tag Pills */}
            {log.tags &&
              log.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="tag-badge"
                  style={{
                    borderColor: `${tag.color}40`,
                    color: tag.color,
                    background: `${tag.color}15`,
                  }}
                >
                  #{tag.name}
                </span>
              ))}
          </div>
        </div>

        <div className="log-card-actions">
          <button
            className="btn btn-icon btn-sm"
            onClick={() => onEdit(log)}
            title="Edit work log"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="btn btn-icon btn-sm btn-danger-ghost"
            onClick={handleDelete}
            disabled={deleting}
            title="Delete work log"
          >
            <Trash2 size={14} />
          </button>
          {log.content_markdown && (
            <button
              className="btn btn-icon btn-sm"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Render Markdown Content if expanded */}
      {expanded && log.content_markdown && renderMarkdown(log.content_markdown)}

      {/* Blocker Note */}
      {log.blockers && log.blockers.trim() && (
        <div className="blocker-alert">
          <AlertTriangle size={14} />
          <span>
            <strong>Blocker:</strong> {log.blockers}
          </span>
        </div>
      )}

      {/* Achievement Note */}
      {log.achievements && log.achievements.trim() && (
        <div className="achievement-alert">
          <Award size={14} />
          <span>
            <strong>Achievement:</strong> {log.achievements}
          </span>
        </div>
      )}
    </div>
  );
};
