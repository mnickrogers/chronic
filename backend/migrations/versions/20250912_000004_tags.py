"""add tags and associations

Revision ID: 20250912_000004
Revises: 20250910_000003
Create Date: 2025-09-12 00:00:04
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250912_000004'
down_revision = '20250910_000003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tags',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('color', sa.String(length=16), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('workspace_id', 'name', name='uq_ws_tag_name'),
    )

    op.create_table(
        'task_tags',
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', sa.String(), sa.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
        sa.UniqueConstraint('task_id', 'tag_id', name='uq_task_tag'),
    )

    op.create_table(
        'project_tags',
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', sa.String(), sa.ForeignKey('tags.id', ondelete='CASCADE'), primary_key=True),
        sa.UniqueConstraint('project_id', 'tag_id', name='uq_project_tag'),
    )


def downgrade() -> None:
    op.drop_table('project_tags')
    op.drop_table('task_tags')
    op.drop_table('tags')

