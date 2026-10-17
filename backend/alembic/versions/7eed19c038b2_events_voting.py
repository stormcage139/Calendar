"""events: description, deadline with time, date options, votes, results

Revision ID: 7eed19c038b2
Revises: 9028e66fe317
Create Date: 2026-10-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7eed19c038b2'
down_revision: Union[str, Sequence[str], None] = '9028e66fe317'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    dialect = op.get_bind().dialect.name

    if dialect == "postgresql":
        # Native enum: add the new status (SQLite stores it as plain VARCHAR).
        op.execute("ALTER TYPE event_status ADD VALUE IF NOT EXISTS 'CANCELLED'")

    # deadline: DATE -> DATETIME through a new column. A plain alter_column makes
    # SQLite batch mode copy the data with CAST(... AS DATETIME), which turns
    # '2026-11-01' into 2026.
    with op.batch_alter_table('events') as batch_op:
        batch_op.add_column(sa.Column('description', sa.String(length=1024), nullable=True))
        batch_op.add_column(sa.Column('deadline_dt', sa.DateTime(), nullable=True))
    if dialect == "sqlite":
        op.execute("UPDATE events SET deadline_dt = deadline || ' 00:00:00.000000'")
    else:
        op.execute("UPDATE events SET deadline_dt = CAST(deadline AS TIMESTAMP)")
    with op.batch_alter_table('events') as batch_op:
        batch_op.drop_column('deadline')
        batch_op.alter_column(
            'deadline_dt',
            new_column_name='deadline',
            existing_type=sa.DateTime(),
            nullable=False,
        )

    op.create_table('date_options',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('event_id', sa.Integer(), nullable=False),
    sa.Column('author_id', sa.Integer(), nullable=False),
    sa.Column('start', sa.DateTime(), nullable=False),
    sa.Column('end', sa.DateTime(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['author_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_date_options_event_id'), 'date_options', ['event_id'], unique=False)
    op.create_table('votes',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('date_option_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['date_option_id'], ['date_options.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('date_option_id', 'user_id', name='uq_votes_option_user')
    )
    op.create_index(op.f('ix_votes_date_option_id'), 'votes', ['date_option_id'], unique=False)
    op.create_table('event_results',
    sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
    sa.Column('event_id', sa.Integer(), nullable=False),
    sa.Column('date_option_id', sa.Integer(), nullable=False),
    sa.Column('resolved_by', sa.Enum('VOTES', 'CREATOR', 'DEADLINE', name='result_resolved_by'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['date_option_id'], ['date_options.id'], ),
    sa.ForeignKeyConstraint(['event_id'], ['events.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('event_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('event_results')
    op.drop_index(op.f('ix_votes_date_option_id'), table_name='votes')
    op.drop_table('votes')
    op.drop_index(op.f('ix_date_options_event_id'), table_name='date_options')
    op.drop_table('date_options')
    dialect = op.get_bind().dialect.name
    with op.batch_alter_table('events') as batch_op:
        batch_op.add_column(sa.Column('deadline_date', sa.Date(), nullable=True))
    if dialect == "sqlite":
        op.execute("UPDATE events SET deadline_date = substr(deadline, 1, 10)")
    else:
        op.execute("UPDATE events SET deadline_date = CAST(deadline AS DATE)")
    with op.batch_alter_table('events') as batch_op:
        batch_op.drop_column('deadline')
        batch_op.drop_column('description')
        batch_op.alter_column(
            'deadline_date',
            new_column_name='deadline',
            existing_type=sa.Date(),
            nullable=False,
        )
    if dialect == "postgresql":
        op.execute("DROP TYPE IF EXISTS result_resolved_by")
