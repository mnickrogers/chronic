"""add user theme preference

Revision ID: 20250912_000006
Revises: 20250912_000005
Create Date: 2025-09-12
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision = '20250912_000006'
down_revision = '20250912_000002'
branch_labels = None
depends_on = None


def upgrade():
    # Add with a default, then backfill and enforce non-null
    with op.batch_alter_table('users') as batch:
        batch.add_column(sa.Column('theme', sa.String(length=16), nullable=True))
    conn = op.get_bind()
    # Backfill existing rows
    conn.execute(text("UPDATE users SET theme = 'nord' WHERE theme IS NULL"))
    # Make non-nullable going forward
    with op.batch_alter_table('users') as batch:
        batch.alter_column('theme', existing_type=sa.String(length=16), nullable=False, server_default='nord')


def downgrade():
    with op.batch_alter_table('users') as batch:
        batch.drop_column('theme')
