-- PostgreSQL Schema for Daily Work Log

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    theme_preference VARCHAR(20) DEFAULT 'dark',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tags (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_tag UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS work_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    title VARCHAR(255) NOT NULL,
    content_markdown TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'done' CHECK (status IN ('done', 'in_progress', 'blocked')),
    blockers TEXT DEFAULT '',
    achievements TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS log_tags (
    log_id INT NOT NULL REFERENCES work_logs(id) ON DELETE CASCADE,
    tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (log_id, tag_id)
);

CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#3b82f6',
    is_current BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_company UNIQUE (user_id, name)
);

ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS skills (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'General',
    proficiency INT NOT NULL DEFAULT 3 CHECK (proficiency >= 1 AND proficiency <= 5),
    years_experience NUMERIC(3, 1) DEFAULT 1.0,
    last_used_at DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_skill UNIQUE (user_id, name)
);

ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs (user_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_status ON work_logs (user_id, status);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags (user_id);
CREATE INDEX IF NOT EXISTS idx_log_tags_tag ON log_tags (tag_id);
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies (user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_company ON work_logs (company_id);
CREATE INDEX IF NOT EXISTS idx_skills_user ON skills (user_id);

-- Clean up legacy unused columns if upgrading existing databases
ALTER TABLE users DROP COLUMN IF EXISTS daily_goal_hours;
ALTER TABLE work_logs DROP COLUMN IF EXISTS duration_minutes;

-- Migration: Automatically migrate existing '#glowing' and '#qburst' tags to Companies
DO $$
BEGIN
    -- Create 'Glowing' company for users who have 'glowing' tag
    INSERT INTO companies (user_id, name, color, is_current)
    SELECT DISTINCT user_id, 'Glowing', '#3b82f6', true
    FROM tags WHERE LOWER(name) = 'glowing'
    ON CONFLICT (user_id, name) DO NOTHING;

    -- Map work_logs with 'glowing' tag to 'Glowing' company
    UPDATE work_logs wl
    SET company_id = c.id
    FROM log_tags lt
    JOIN tags t ON lt.tag_id = t.id
    JOIN companies c ON c.user_id = t.user_id AND c.name = 'Glowing'
    WHERE wl.id = lt.log_id AND LOWER(t.name) = 'glowing' AND wl.company_id IS NULL;

    -- Create 'QBurst' company for users who have 'qburst' tag
    INSERT INTO companies (user_id, name, color, is_current)
    SELECT DISTINCT user_id, 'QBurst', '#8b5cf6', false
    FROM tags WHERE LOWER(name) = 'qburst'
    ON CONFLICT (user_id, name) DO NOTHING;

    -- Map work_logs with 'qburst' tag to 'QBurst' company
    UPDATE work_logs wl
    SET company_id = c.id
    FROM log_tags lt
    JOIN tags t ON lt.tag_id = t.id
    JOIN companies c ON c.user_id = t.user_id AND c.name = 'QBurst'
    WHERE wl.id = lt.log_id AND LOWER(t.name) = 'qburst' AND wl.company_id IS NULL;
END $$;


