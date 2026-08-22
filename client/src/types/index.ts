export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  theme_preference: 'dark' | 'light';
  created_at: string;
}

export interface Company {
  id: number;
  name: string;
  color: string;
  is_current: boolean;
  created_at?: string;
  log_count?: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at?: string;
  log_count?: number;
}

export type LogStatus = 'done' | 'in_progress' | 'blocked';

export interface WorkLog {
  id: number;
  user_id: number;
  log_date: string; // 'YYYY-MM-DD'
  title: string;
  content_markdown: string;
  status: LogStatus;
  blockers?: string;
  achievements?: string;
  company_id?: number | null;
  company?: Company | null;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface DayStats {
  date_str: string;
  day_name: string;
  count: number;
}

export interface TagStats {
  name: string;
  color: string;
  log_count: number;
}

export interface StatsData {
  streak: number;
  today: {
    count: number;
    done: number;
    inProgress: number;
    blocked: number;
  };
  week: {
    count: number;
  };
  last7Days: DayStats[];
  tags: TagStats[];
}

export interface FilterState {
  search: string;
  startDate: string;
  endDate: string;
  tag: string;
  companyId: string;
  status: string;
  datePreset: 'all' | 'today' | 'yesterday' | 'week' | 'month';
}
