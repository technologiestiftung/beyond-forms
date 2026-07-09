import asyncpg
import logging
from src.utils.config import DATABASE_URL

logger = logging.getLogger(__name__)


class DatabaseProvider:
    pool: asyncpg.Pool = None


async def init_db_pool():
    logger.info("Initializing asyncpg connection pool...")
    try:
        DatabaseProvider.pool = await asyncpg.create_pool(dsn=DATABASE_URL, min_size=1, max_size=10)
        logger.info("Database connection pool established.")
    except Exception as e:
        logger.error(f"Failed to connect to the database: {e}")
        raise


async def close_db_pool():
    if DatabaseProvider.pool:
        logger.info("Closing asyncpg connection pool...")
        await DatabaseProvider.pool.close()


def get_db_pool() -> asyncpg.Pool:
    if DatabaseProvider.pool is None:
        raise RuntimeError("Database pool is not initialized")
    return DatabaseProvider.pool
