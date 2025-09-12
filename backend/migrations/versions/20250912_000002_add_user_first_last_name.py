"""add user first_name/last_name

Revision ID: 20250912_000002
Revises: 20250912_000005
Create Date: 2025-09-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = '20250912_000002'
down_revision = '20250912_000005'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('first_name', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(length=255), nullable=True))

    # Best-effort backfill from display_name
    conn = op.get_bind()
    try:
        rows = conn.execute(text("SELECT id, display_name FROM users")).fetchall()
        for r in rows:
            disp = (r.display_name or '').strip()
            parts = [p for p in disp.split(' ') if p]
            first = parts[0] if parts else None
            last = ' '.join(parts[1:]) if len(parts) > 1 else None
            conn.execute(
                text("UPDATE users SET first_name = :first, last_name = :last WHERE id = :id"),
                {"first": first, "last": last, "id": r.id}
            )
    except Exception:
        # If anything goes wrong, leave columns nullable without backfill
        pass


def downgrade():
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
