"""add name_norm for case-insensitive tag uniqueness

Revision ID: 20250912_000005
Revises: 20250912_000004
Create Date: 2025-09-12 00:00:05
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250912_000005'
down_revision = '20250912_000004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('tags') as batch:
        batch.add_column(sa.Column('name_norm', sa.String(length=64), nullable=True))
    # Backfill existing rows
    conn = op.get_bind()
    conn.exec_driver_sql("UPDATE tags SET name_norm = lower(name)")
    # Make it non-nullable
    with op.batch_alter_table('tags') as batch:
        batch.alter_column('name_norm', existing_type=sa.String(length=64), nullable=False)
        # Add new unique constraint for (workspace_id, name_norm)
        batch.create_unique_constraint('uq_ws_tag_name_norm', ['workspace_id', 'name_norm'])


def downgrade() -> None:
    # Best-effort: drop the name_norm unique and column
    with op.batch_alter_table('tags') as batch:
        try:
            batch.drop_constraint('uq_ws_tag_name_norm', type_='unique')
        except Exception:
            pass
        batch.drop_column('name_norm')

