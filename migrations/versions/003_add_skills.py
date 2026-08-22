"""003_add_skills

Revision ID: 003_add_skills
Revises: 002_add_companies
Create Date: 2026-08-22 15:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '003_add_skills'
down_revision: Union[str, None] = '002_add_companies'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Skills Table
    op.execute("""
        CREATE TABLE IF NOT EXISTS skills (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            name VARCHAR(100) NOT NULL,
            category VARCHAR(50) DEFAULT 'General',
            proficiency INT NOT NULL DEFAULT 3 CHECK (proficiency >= 1 AND proficiency <= 5),
            years_experience NUMERIC(3, 1) DEFAULT 1.0,
            last_used_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_user_skill UNIQUE (user_id, name)
        );
    """)

    op.execute("ALTER TABLE skills ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;")
    op.execute("ALTER TABLE skills ADD COLUMN IF NOT EXISTS last_used_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_skills_user ON skills (user_id);")

def downgrade() -> None:
    pass
