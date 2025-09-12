"""baseline schema

Revision ID: 20250907_000001
Revises: 
Create Date: 2025-09-07 00:00:01
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250907_000001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users
    op.create_table(
        'users',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('email', sa.String(length=320), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # organizations
    op.create_table(
        'organizations',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('primary_domain', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    # org_memberships
    op.create_table(
        'org_memberships',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('org_id', 'user_id', name='uq_org_user'),
    )

    # workspaces
    op.create_table(
        'workspaces',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

    op.create_table(
        'workspace_memberships',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('workspace_id', 'user_id', name='uq_ws_user'),
    )

    # projects
    op.create_table(
        'projects',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('visibility', sa.String(length=16), nullable=False),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'project_memberships',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('project_id', 'user_id', name='uq_proj_user'),
    )

    op.create_table(
        'project_statuses',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('key', sa.String(length=32), nullable=False),
        sa.Column('label', sa.String(length=64), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
        sa.Column('is_done', sa.Boolean(), nullable=False),
    )

    op.create_table(
        'project_sections',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('position', sa.Integer(), nullable=False),
    )

    # tasks
    op.create_table(
        'tasks',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), nullable=False),
        sa.Column('workspace_id', sa.String(), nullable=False),
        sa.Column('project_id', sa.String(), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(length=512), nullable=False),
        sa.Column('description', sa.JSON(), nullable=True),
        sa.Column('status_id', sa.String(), sa.ForeignKey('project_statuses.id', ondelete='SET NULL')),
        sa.Column('priority', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), nullable=False),
        sa.Column('created_by', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
    )

    op.create_table(
        'task_assignees',
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True),
    )

    # comments
    op.create_table(
        'comments',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('org_id', sa.String(), nullable=False),
        sa.Column('task_id', sa.String(), sa.ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False),
        sa.Column('author_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('body', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('comments')
    op.drop_table('task_assignees')
    op.drop_table('tasks')
    op.drop_table('project_sections')
    op.drop_table('project_statuses')
    op.drop_table('project_memberships')
    op.drop_table('projects')
    op.drop_table('workspace_memberships')
    op.drop_table('workspaces')
    op.drop_table('org_memberships')
    op.drop_table('organizations')
    op.drop_table('users')
