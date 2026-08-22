import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Alembic Config object
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = None

def get_url():
    """
    Dynamically retrieve PostgreSQL database URL from process environment.
    Supports local docker compose and cloud databases like Neon DB.
    """
    url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/worklog")
    
    # SQLAlchemy requires 'postgresql://' protocol scheme instead of legacy 'postgres://'
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
        
    return url

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = get_url()
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = url

    # Detect SSL requirements (Neon DB or DB_SSL=true)
    db_ssl = os.getenv("DB_SSL", "").lower() in ("true", "1") or "sslmode=require" in url or "neon.tech" in url
    connect_args = {}
    if db_ssl:
        connect_args["sslmode"] = "require"

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
