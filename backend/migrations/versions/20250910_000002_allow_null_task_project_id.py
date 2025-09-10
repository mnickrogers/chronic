from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250910_000002'
down_revision = '20250907_000001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('tasks') as batch:
        batch.alter_column('project_id', existing_type=sa.String(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table('tasks') as batch:
        batch.alter_column('project_id', existing_type=sa.String(), nullable=False)

