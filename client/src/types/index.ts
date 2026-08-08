export interface User {
  id: number;
  email: string;
  username: string;
  full_name?: string;
  daily_goal_hours: number;
  theme_preference: 'dark' | 'light';
  created_at: string;
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
  duration_minutes: number;
  status: LogStatus;
  blockers?: string;
  achievements?: string;
  created_at: string;
  updated_at: string;
  tags: Tag[];
}

export interface DayStats {
  date_str: string;
  day_name: string;
  minutes: number;
  count: number;
}

export interface TagStats {
  name: string;
  color: string;
  total_minutes: number;
  log_count: number;
}

export interface StatsData {
  streak: number;
  dailyGoalHours: number;
  today: {
    minutes: number;
    hours: number;
    goalPercentage: number;
    count: number;
    done: number;
    inProgress: number;
    blocked: number;
  };
  week: {
    minutes: number;
    hours: number;
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
  status: string;
  datePreset: 'all' | 'today' | 'yesterday' | 'week' | 'month';
}
