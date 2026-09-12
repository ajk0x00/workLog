#!/usr/bin/env python3
"""Add a new WorkLog member directly to the database (replaces the removed register endpoint).

Usage:
    python3 scripts/add_user.py --username alex --email alex@example.com
    python3 scripts/add_user.py --username alex --email alex@example.com --full-name "Alex Johnson" --password secret123

Requires: pip install psycopg2-binary bcrypt
Database connection uses the DATABASE_URL env var (same as the app and Alembic),
falling back to postgresql://postgres:postgres@localhost:5432/worklog.
"""

import argparse
import getpass
import os
import sys

import bcrypt
import psycopg2

DEFAULT_TAGS = [
    ("feature", "#10b981"),
    ("bugfix", "#ef4444"),
    ("meeting", "#f59e0b"),
    ("planning", "#6366f1"),
    ("code-review", "#8b5cf6"),
    ("devops", "#06b6d4"),
]


def get_connection():
    url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/worklog")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    kwargs = {}
    db_ssl = (
        os.getenv("DB_SSL", "").lower() in ("true", "1")
        or "sslmode=require" in url
        or "neon.tech" in url
    )
    if db_ssl:
        kwargs["sslmode"] = "require"

    return psycopg2.connect(url, **kwargs)


def prompt_password(args):
    if args.password:
        password = args.password
    else:
        password = getpass.getpass("Password for new member (min 6 chars): ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            sys.exit("Error: passwords do not match.")
    if len(password) < 6:
        sys.exit("Error: password must be at least 6 characters long.")
    return password


def main():
    parser = argparse.ArgumentParser(description="Add a new WorkLog member.")
    parser.add_argument("--username", required=True, help="Login username (min 3 chars, lowercased)")
    parser.add_argument("--email", required=True, help="Email address (lowercased)")
    parser.add_argument("--full-name", default=None, help="Full display name (defaults to username)")
    parser.add_argument("--password", default=None, help="Password (prompted securely if omitted)")
    args = parser.parse_args()

    username = args.username.strip().lower()
    email = args.email.strip().lower()
    full_name = (args.full_name or "").strip() or username

    if len(username) < 3:
        sys.exit("Error: username must be at least 3 characters long.")
    if "@" not in email or "." not in email.split("@")[-1]:
        sys.exit("Error: invalid email address.")

    password = prompt_password(args)
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=10)).decode("utf-8")

    try:
        conn = get_connection()
    except Exception as err:
        sys.exit(f"Error: could not connect to database: {err}")

    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM users WHERE email = %s OR username = %s",
                    (email, username),
                )
                if cur.fetchone() is not None:
                    sys.exit(f"Error: a member with email '{email}' or username '{username}' already exists.")

                cur.execute(
                    "INSERT INTO users (email, username, password_hash, full_name) "
                    "VALUES (%s, %s, %s, %s) RETURNING id",
                    (email, username, password_hash, full_name),
                )
                user_id = cur.fetchone()[0]

                cur.executemany(
                    "INSERT INTO tags (user_id, name, color) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                    [(user_id, name, color) for name, color in DEFAULT_TAGS],
                )
    except Exception as err:
        sys.exit(f"Error: failed to create member: {err}")
    finally:
        conn.close()

    print(f"Member '{username}' created successfully (id: {user_id}). They can now sign in.")


if __name__ == "__main__":
    main()
