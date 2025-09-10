"""remove foreign key constraint from tasks.status_id

Revision ID: 20250910_000003
Revises: 20250910_000002
Create Date: 2025-09-10 00:00:03
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250910_000003'
down_revision = '20250910_000002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop FK tasks.status_id -> project_statuses.id if present
    # Postgres default name is typically 'tasks_status_id_fkey'
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    fks = inspector.get_foreign_keys('tasks')
    for fk in fks:
        if fk.get('referred_table') == 'project_statuses' and 'status_id' in fk.get('constrained_columns', []):
            op.drop_constraint(fk['name'], 'tasks', type_='foreignkey')
            break


def downgrade() -> None:
    # Recreate FK (best-effort) back to project_statuses.id with ON DELETE SET NULL
    op.create_foreign_key(
        'tasks_status_id_fkey',
        'tasks',
        'project_statuses',
        local_cols=['status_id'],
        remote_cols=['id'],
        ondelete='SET NULL'
    )

