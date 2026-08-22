"""001_initial_schema

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-08-22 15:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial_schema'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Users Table
    op.execute("""
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
    """)

    # Tags Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS tags (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(50) NOT NULL,
            color VARCHAR(20) NOT NULL DEFAULT '#6366f1',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_user_tag UNIQUE (user_id, name)
        );
    """)

    # Work Logs Table
    op.execute("""
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
    """)

    # Log Tags Junction Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS log_tags (
            log_id INT NOT NULL REFERENCES work_logs(id) ON DELETE CASCADE,
            tag_id INT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
            PRIMARY KEY (log_id, tag_id)
        );
    """)

    # Indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs (user_id, log_date DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_work_logs_user_status ON work_logs (user_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_tags_user ON tags (user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_log_tags_tag ON log_tags (tag_id);")

def downgrade() -> None:
    pass
