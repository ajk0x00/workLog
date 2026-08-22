import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from './context/AuthContext.js';
import type { WorkLog, Tag, StatsData, FilterState, LogStatus } from './types/index.js';
import { api } from './utils/api.js';
import { Navbar } from './components/Navbar.js';
import { QuickLogBar } from './components/QuickLogBar.js';
import { FilterBar } from './components/FilterBar.js';
import { LogCard } from './components/LogCard.js';
import { LogModal } from './components/LogModal.js';
import { ExportModal } from './components/ExportModal.js';
import { AuthModal } from './components/AuthModal.js';
import { ProfileModal } from './components/ProfileModal.js';
import { StatsOverview } from './components/StatsOverview.js';
import { Plus, BookOpen, Sparkles, LogIn } from 'lucide-react';

export const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();

  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [groupedLogs, setGroupedLogs] = useState<Record<string, WorkLog[]>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    startDate: '',
    endDate: '',
    tag: '',
    status: '',
    datePreset: 'all',
  });

  // Modal states
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Fetch Tags
  const fetchTags = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ tags: Tag[] }>('/api/tags');
      setTags(res.tags);
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  }, [user]);

  // Fetch Stats
  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<StatsData>('/api/stats');
      setStats(res);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, [user]);

  // Fetch Logs with active filters
  const fetchLogs = useCallback(async () => {
    if (!user) {
      setLogs([]);
      setGroupedLogs({});
      return;
    }

    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.startDate) params.set('startDate', filters.startDate);
      if (filters.endDate) params.set('endDate', filters.endDate);
      if (filters.tag) params.set('tag', filters.tag);
      if (filters.status) params.set('status', filters.status);

      const res = await api.get<{
        total: number;
        logs: WorkLog[];
        grouped: Record<string, WorkLog[]>;
      }>(`/api/logs?${params.toString()}`);

      setLogs(res.logs);
      setGroupedLogs(res.grouped);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }, [user, filters]);

  // Reload data when user or filters change
  useEffect(() => {
    if (user) {
      fetchLogs();
      fetchTags();
      fetchStats();
    }
  }, [user, fetchLogs, fetchTags, fetchStats]);

  // Add Log
  const handleAddLog = async (data: {
    title: string;
    status: LogStatus;
    tags: string[];
    contentMarkdown?: string;
  }) => {
    try {
      await api.post('/api/logs', {
        title: data.title,
        status: data.status,
        tags: data.tags,
        contentMarkdown: data.contentMarkdown,
      });
      await fetchLogs();
      await fetchTags();
      await fetchStats();
    } catch (err: any) {
      if (err?.statusCode === 401 || err?.message?.includes('Authentication')) {
        setAuthOpen(true);
      }
      throw err;
    }
  };

  // Save (Create or Edit) Detailed Log
  const handleSaveDetailedLog = async (data: {
    id?: number;
    title: string;
    logDate: string;
    contentMarkdown: string;
    status: LogStatus;
    blockers: string;
    achievements: string;
    tags: string[];
  }) => {
    try {
      if (data.id) {
        await api.put(`/api/logs/${data.id}`, data);
      } else {
        await api.post('/api/logs', data);
      }
      await fetchLogs();
      await fetchTags();
      await fetchStats();
    } catch (err: any) {
      if (err?.statusCode === 401 || err?.message?.includes('Authentication')) {
        setAuthOpen(true);
      }
      throw err;
    }
  };

  // Status Change
  const handleStatusChange = async (id: number, status: LogStatus) => {
    await api.patch(`/api/logs/${id}/status`, { status });
    await fetchLogs();
    await fetchStats();
  };

  // Delete Log
  const handleDeleteLog = async (id: number) => {
    await api.delete(`/api/logs/${id}`);
    await fetchLogs();
    await fetchTags();
    await fetchStats();
  };

  // Update markdown directly (from interactive task checkbox click)
  const handleUpdateContent = async (id: number, newMarkdown: string) => {
    await api.put(`/api/logs/${id}`, { contentMarkdown: newMarkdown });
    // Update local state smoothly
    setLogs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, content_markdown: newMarkdown } : l))
    );
    setGroupedLogs((prev) => {
      const nextGrouped: Record<string, WorkLog[]> = {};
      for (const [dateKey, group] of Object.entries(prev)) {
        nextGrouped[dateKey] = group.map((l) =>
          l.id === id ? { ...l, content_markdown: newMarkdown } : l
        );
      }
      return nextGrouped;
    });
  };

  // Create Tag
  const handleCreateTag = async (name: string, color: string): Promise<Tag> => {
    const res = await api.post<{ tag: Tag }>('/api/tags', { name, color });
    await fetchTags();
    return res.tag;
  };

  const handleOpenEdit = (log: WorkLog) => {
    setEditingLog(log);
    setLogModalOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingLog(null);
    setLogModalOpen(true);
  };

  const handleClearFilters = () => {
    setFilters({
      search: '',
      startDate: '',
      endDate: '',
      tag: '',
      status: '',
      datePreset: 'all',
    });
  };

  // Format date header nicely
  const formatDateHeader = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.toISOString().split('T')[0];

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  };

  if (authLoading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
        }}
      >
        <span>Loading WorkLog session...</span>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar
        stats={stats}
        onOpenExport={() => setExportOpen(true)}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />

      <main className="main-content">
        {user ? (
          <>
            {/* End of Shift Quick Log Bar */}
            <QuickLogBar
              tags={tags}
              onAddLog={handleAddLog}
              onOpenDetailedModal={handleOpenCreate}
              streakCount={stats?.streak || 0}
            />

            {/* Productivity & Shift Overview */}
            <StatsOverview stats={stats} />

            {/* Search, Filter & Category Bar */}
            <FilterBar
              filters={filters}
              onFilterChange={(newFilters) => setFilters((prev) => ({ ...prev, ...newFilters }))}
              tags={tags}
              onClearFilters={handleClearFilters}
              totalLogs={logs.length}
            />

            {/* Timeline of Shift Logs */}
            <div className="timeline-section">
              {Object.keys(groupedLogs).length === 0 ? (
                <div className="empty-state">
                  <BookOpen className="empty-icon" />
                  <div className="empty-title">
                    {filters.search || filters.tag || filters.status
                      ? 'No shift entries match your filter'
                      : 'No shift logs recorded for today'}
                  </div>
                  <div className="empty-desc">
                    {filters.search || filters.tag || filters.status
                      ? 'Try clearing some filters or searching for another keyword.'
                      : 'Add your end-of-shift work summary, task checklists, and handover notes above.'}
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleOpenCreate}>
                    <Plus size={14} />
                    <span>Create Shift Entry</span>
                  </button>
                </div>
              ) : (
                Object.entries(groupedLogs).map(([dateKey, dateLogs]) => {
                  return (
                    <div key={dateKey} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div className="date-group-header">
                        <span className="date-group-title">
                          📅 {formatDateHeader(dateKey)}{' '}
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                            ({dateKey})
                          </span>
                        </span>
                        <span className="date-group-total">
                          {dateLogs.length} {dateLogs.length === 1 ? 'shift entry' : 'shift entries'}
                        </span>
                      </div>

                      <div className="log-cards-list">
                        {dateLogs.map((log) => (
                          <LogCard
                            key={log.id}
                            log={log}
                            onEdit={handleOpenEdit}
                            onDelete={handleDeleteLog}
                            onStatusChange={handleStatusChange}
                            onUpdateContent={handleUpdateContent}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          /* Guest / Logged Out View */
          <div className="empty-state" style={{ marginTop: 40, padding: '60px 24px' }}>
            <div className="brand-icon" style={{ width: 44, height: 44, margin: '0 auto 16px auto' }}>
              <Sparkles size={24} />
            </div>
            <h1 className="empty-title" style={{ fontSize: '1.6rem', marginBottom: 8 }}>
              Modern Minimalist Work Journal
            </h1>
            <p className="empty-desc" style={{ maxWidth: 440, marginBottom: 24, fontSize: '0.95rem' }}>
              Track daily tasks, maintain streaks, log handover notes, and export shift reports with PostgreSQL persistence.
            </p>
            <button
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontSize: '1rem' }}
              onClick={() => setAuthOpen(true)}
            >
              <LogIn size={18} />
              <span>Get Started / Sign In</span>
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <LogModal
        isOpen={logModalOpen}
        onClose={() => setLogModalOpen(false)}
        onSave={handleSaveDetailedLog}
        initialLog={editingLog}
        allTags={tags}
        onCreateTag={handleCreateTag}
      />

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} />

      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} />

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
};

export default App;
