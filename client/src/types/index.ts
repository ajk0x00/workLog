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
  job_title?: string | null;
  location?: string | null;
  start_month?: string | null;
  end_month?: string | null;
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

export interface Skill {
  id: number;
  user_id: number;
  name: string;
  category: string;
  proficiency: number; // 1 to 5
  years_experience: number;
  last_used_year?: number; // e.g. 2026
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Resume {
  id: number;
  title: string;
  target_role?: string | null;
  content_markdown?: string;
  model: string;
  created_at: string;
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

export interface FilterState {
  search: string;
  startDate: string;
  endDate: string;
  tag: string;
  companyId: string;
  status: string;
  datePreset: 'all' | 'today' | 'yesterday' | 'week' | 'month';
}
