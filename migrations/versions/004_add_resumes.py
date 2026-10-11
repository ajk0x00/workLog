"""004_add_resumes

Revision ID: 004_add_resumes
Revises: 003_add_skills
Create Date: 2026-09-12 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '004_add_resumes'
down_revision: Union[str, None] = '003_add_skills'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS resumes (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(200) NOT NULL,
            target_role VARCHAR(200),
            content_markdown TEXT NOT NULL,
            model VARCHAR(200) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes (user_id);")

def downgrade() -> None:
    pass
