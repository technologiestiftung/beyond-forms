import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


def construct_db_url(user: str, password: str, host: str, port: str, name: str) -> str:
    # URL-encode the credentials to handle special characters (e.g. '@') in user/password
    quoted_user = urllib.parse.quote(user, safe="")
    quoted_password = urllib.parse.quote(password, safe="")
    return f"postgresql://{quoted_user}:{quoted_password}@{host}:{port}/{name}"


DB_USER = os.environ.get("POSTGRES_USER", "devuser")
DB_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "devpassword")
DB_HOST = os.environ.get("POSTGRES_HOST", "postgres")
DB_PORT = os.environ.get("POSTGRES_PORT", "5432")
DB_NAME = os.environ.get("POSTGRES_DATABASE", "devdb")

SQLALCHEMY_DATABASE_URL = construct_db_url(DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)

DB_POOL_SIZE = int(os.environ.get("DB_POOL_SIZE", "5"))
DB_MAX_OVERFLOW = int(os.environ.get("DB_MAX_OVERFLOW", "10"))

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_MAX_OVERFLOW,
    pool_timeout=30,
    pool_recycle=300,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.rollback()  # rollback all uncommitted transactions so they don't leak
        db.close()
