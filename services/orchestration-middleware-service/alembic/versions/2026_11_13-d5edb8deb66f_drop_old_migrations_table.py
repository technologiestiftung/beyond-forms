"""drop old migrations table

Revision ID: d5edb8deb66f
Revises: 61799c06a530
Create Date: 2026-11-13 16:33:15.406724

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'd5edb8deb66f'
down_revision: Union[str, Sequence[str], None] = '61799c06a530'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("DROP TABLE IF EXISTS migrations")


def downgrade() -> None:
    """Downgrade schema."""
    op.create_table('migrations',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('filename', sa.VARCHAR(length=255), autoincrement=False, nullable=False),
    sa.Column('status', sa.VARCHAR(length=50), autoincrement=False, nullable=False),
    sa.Column('applied_at', postgresql.TIMESTAMP(), server_default=sa.text('CURRENT_TIMESTAMP'), autoincrement=False, nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('migrations_pkey')),
    sa.UniqueConstraint('filename', name=op.f('migrations_filename_key'), postgresql_include=[], postgresql_nulls_not_distinct=False)
    )
