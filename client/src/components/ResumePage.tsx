import React, { useState, useEffect, useCallback } from 'react';
import type { Company, Resume } from '../types/index.js';
import { api } from '../utils/api.js';
import {
  FileText,
  Download,
  Trash2,
  Sparkles,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';

interface ResumePageProps {
  companies: Company[];
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'resume';

export const ResumePage: React.FC<ResumePageProps> = ({ companies }) => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);

  // Generate form
  const [targetRole, setTargetRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expanded resume previews: id -> full resume
  const [expanded, setExpanded] = useState<Record<number, Resume>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  const fetchResumes = useCallback(async () => {
    try {
      const res = await api.get<{ resumes: Resume[] }>('/api/resumes');
      setResumes(res.resumes);
    } catch (err: any) {
      console.error('Failed to load resumes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generating) return;
    setError(null);
    setGenerating(true);

    try {
      const res = await api.post<{ resume: Resume; message: string }>('/api/resumes/generate', {
        targetRole: targetRole.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        companyId: companyId || undefined,
      });
      setResumes((prev) => [res.resume, ...prev]);
      setExpanded((prev) => ({ ...prev, [res.resume.id]: res.resume }));
      setJobDescription('');
    } catch (err: any) {
      setError(err.message || 'Failed to generate resume');
    } finally {
      setGenerating(false);
    }
  };

  const togglePreview = async (resume: Resume) => {
    if (expanded[resume.id]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[resume.id];
        return next;
      });
      return;
    }

    if (resume.content_markdown) {
      setExpanded((prev) => ({ ...prev, [resume.id]: resume }));
      return;
    }

    try {
      setBusyId(resume.id);
      const res = await api.get<{ resume: Resume }>(`/api/resumes/${resume.id}`);
      const full = res.resume;
      setResumes((prev) => prev.map((r) => (r.id === full.id ? { ...r, ...full } : r)));
      setExpanded((prev) => ({ ...prev, [full.id]: full }));
    } catch (err: any) {
      alert(err.message || 'Failed to load resume');
    } finally {
      setBusyId(null);
    }
  };

  const getFullResume = (resume: Resume): Resume | undefined =>
    expanded[resume.id] || resume.content_markdown ? resume : undefined;

  const handleDownload = async (resume: Resume) => {
    let full = getFullResume(resume);
    if (!full?.content_markdown) {
      try {
        setBusyId(resume.id);
        const res = await api.get<{ resume: Resume }>(`/api/resumes/${resume.id}`);
        full = res.resume;
      } catch (err: any) {
        alert(err.message || 'Failed to load resume');
        return;
      } finally {
        setBusyId(null);
      }
    }
    const blob = new Blob([full!.content_markdown || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(full!.title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (resume: Resume) => {
    if (!window.confirm(`Delete "${resume.title}"?`)) return;
    try {
      setBusyId(resume.id);
      await api.delete(`/api/resumes/${resume.id}`);
      setResumes((prev) => prev.filter((r) => r.id !== resume.id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete resume');
    } finally {
      setBusyId(null);
    }
  };

  const renderMarkdown = (content: string) => {
    const lines = content.split('\n');
    return (
      <div className="log-markdown-body">
        {lines.map((line, idx) => {
          if (line.startsWith('### ')) {
            return <h3 key={idx}>{line.slice(4)}</h3>;
          }
          if (line.startsWith('## ')) {
            return <h2 key={idx}>{line.slice(3)}</h2>;
          }
          if (line.startsWith('# ')) {
            return <h1 key={idx}>{line.slice(2)}</h1>;
          }
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <li key={idx} style={{ marginLeft: 16 }}>
                {line.slice(2).replace(/\*\*/g, '')}
              </li>
            );
          }
          if (line.startsWith('```')) {
            return null;
          }
          if (!line.trim()) {
            return <div key={idx} style={{ height: 6 }} />;
          }
          return <p key={idx}>{line.replace(/\*\*/g, '')}</p>;
        })}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={22} color="var(--accent-primary)" />
          Resume Generator
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
          Generate an ATS-optimized resume in Markdown from your work logs, skills matrix, and employment history.
        </p>
      </div>

      {/* Generate Card */}
      <div className="quick-log-card" style={{ padding: 20 }}>
        <form onSubmit={handleGenerate}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Target Role (optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="E.g., Senior DevOps Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Scope (optional)</label>
              <select
                className="form-select"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                title="Limit the resume to work logs of a single company"
              >
                <option value="">All companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏢 {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Job Description (optional — mirrors keywords for ATS matching)</label>
            <textarea
              className="form-input"
              style={{ minHeight: 96, resize: 'vertical' }}
              placeholder="Paste a job description here to optimize the resume against it..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          {error && (
            <div className="blocker-alert" style={{ marginBottom: 12 }}>
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={generating}>
              {generating ? (
                <>
                  <Loader2 size={16} className="spin-icon" />
                  <span>Generating… (can take up to a minute)</span>
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  <span>Generate Resume</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Saved Resumes */}
      <div>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 12px 0' }}>Saved Resumes</h2>

        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : resumes.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 24px' }}>
            <FileText className="empty-icon" />
            <div className="empty-title">No resumes generated yet</div>
            <div className="empty-desc">
              Fill the form above and generate your first ATS-optimized resume from your work history.
            </div>
          </div>
        ) : (
          <div className="log-cards-list">
            {resumes.map((resume) => {
              const full = expanded[resume.id];
              return (
                <div key={resume.id} className="log-card" style={{ padding: 16 }}>
                  <div className="log-card-header">
                    <div className="log-title-area">
                      <div className="log-title">{resume.title}</div>
                      <div className="log-card-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {resume.target_role && (
                          <span className="tag-badge" style={{ color: 'var(--accent-primary)' }}>
                            🎯 {resume.target_role}
                          </span>
                        )}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {formatDate(resume.created_at)} · {resume.model.split('/').pop()}
                        </span>
                      </div>
                    </div>

                    <div className="log-card-actions">
                      <button
                        className="btn btn-icon btn-sm"
                        onClick={() => togglePreview(resume)}
                        disabled={busyId === resume.id}
                        title={full ? 'Collapse' : 'Preview'}
                      >
                        {full ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        className="btn btn-icon btn-sm"
                        onClick={() => handleDownload(resume)}
                        disabled={busyId === resume.id}
                        title="Download .md"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        className="btn btn-icon btn-sm btn-danger-ghost"
                        onClick={() => handleDelete(resume)}
                        disabled={busyId === resume.id}
                        title="Delete resume"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {full?.content_markdown && renderMarkdown(full.content_markdown)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
