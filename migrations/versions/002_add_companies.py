"""002_add_companies

Revision ID: 002_add_companies
Revises: 001_initial_schema
Create Date: 2026-08-22 15:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002_add_companies'
down_revision: Union[str, None] = '001_initial_schema'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Companies Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(20) DEFAULT '#3b82f6',
            is_current BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_user_company UNIQUE (user_id, name)
        );
    """)

    # Company ID column on work_logs
    op.execute("ALTER TABLE work_logs ADD COLUMN IF NOT EXISTS company_id INT REFERENCES companies(id) ON DELETE SET NULL;")

    # Indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_companies_user ON companies (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_work_logs_company ON work_logs (company_id);")

    # Migration Script: Automatically migrate existing '#glowing' and '#qburst' tags to Companies
    op.execute("""
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
    """)

def downgrade() -> None:
    pass
