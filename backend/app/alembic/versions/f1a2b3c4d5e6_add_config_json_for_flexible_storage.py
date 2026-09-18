"""add config_json for flexible storage

Revision ID: f1a2b3c4d5e6
Revises: 19d0f9403cd3
Create Date: 2026-09-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = '19d0f9403cd3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenant_whatsapp', sa.Column('config_json', sa.String(), nullable=False, server_default=''))
    op.add_column('tenant_conecta', sa.Column('config_json', sa.String(), nullable=False, server_default=''))


def downgrade() -> None:
    op.drop_column('tenant_conecta', 'config_json')
    op.drop_column('tenant_whatsapp', 'config_json')
