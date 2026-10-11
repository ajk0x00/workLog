"""005_company_resume_fields

Revision ID: 005_company_resume_fields
Revises: 004_add_resumes
Create Date: 2026-09-12 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = '005_company_resume_fields'
down_revision: Union[str, None] = '004_add_resumes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS job_title VARCHAR(150);")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS location VARCHAR(150);")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS start_month VARCHAR(7);")
    op.execute("ALTER TABLE companies ADD COLUMN IF NOT EXISTS end_month VARCHAR(7);")

def downgrade() -> None:
    pass
