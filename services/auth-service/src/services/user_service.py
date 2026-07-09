import logging
from asyncpg import Pool

logger = logging.getLogger(__name__)


async def get_or_create_user(pool: Pool, phone_number: str, authentik_id: str) -> str:
    """
    Retrieves a user by their phone number, or creates a new one. Saves/updates the authentik_id.
    """
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO users (phone_number, authentik_id)
            VALUES ($1, $2)
            ON CONFLICT (phone_number)
            DO UPDATE SET authentik_id = EXCLUDED.authentik_id
            RETURNING id;
            """,
            phone_number,
            authentik_id,
        )
        return row["id"]
