#!/usr/bin/env python3
"""Export all WorkLog data to a JSON dump for migration to careerTrack.

Works both in production (inside Docker container or on the VM) and locally.
Can connect via DATABASE_URL or values from .env.

Usage examples:
    # 1. Inside production Docker container:
    docker compose exec app python3 scripts/export_data.py -o /app/worklog_export.json
    docker compose cp app:/app/worklog_export.json ./worklog_export.json

    # 2. Directly on production host or locally:
    python3 scripts/export_data.py -o worklog_export.json

    # 3. Export specific user only:
    python3 scripts/export_data.py --email user@example.com -o user_export.json

    # 4. Stream JSON to stdout:
    python3 scripts/export_data.py > worklog_export.json
"""

import argparse
import datetime
import decimal
import json
import os
import sys


class CustomJSONEncoder(json.JSONEncoder):
    """JSON encoder that handles dates, datetimes, and decimals."""

    def default(self, obj):
        if isinstance(obj, (datetime.date, datetime.datetime)):
            return obj.isoformat()
        if isinstance(obj, decimal.Decimal):
            return float(obj)
        return super().default(obj)


def load_env_file():
    """Load variables from .env file if DATABASE_URL is not already in os.environ."""
    candidates = [
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
    ]
    for path in candidates:
        if os.path.isfile(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            if k not in os.environ:
                                os.environ[k] = v
                break
            except Exception:
                pass


def get_db_connection(db_url_arg=None):
    """Establish connection to PostgreSQL."""
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        sys.exit(
            "Error: 'psycopg2' is required.\n"
            "Install it via: pip install psycopg2-binary\n"
            "Or run the Node export script which uses already-installed dependencies:\n"
            "  node scripts/export_data.js -o worklog_export.json\n"
            "Or run inside the WorkLog container where psycopg2 is installed:\n"
            "  docker compose exec app python3 scripts/export_data.py"
        )

    load_env_file()

    url = db_url_arg or os.getenv("DATABASE_URL")
    if not url:
        host = os.getenv("POSTGRES_SERVER") or os.getenv("DB_HOST", "localhost")
        port = os.getenv("POSTGRES_PORT") or os.getenv("DB_PORT", "5432")
        user = os.getenv("POSTGRES_USER") or os.getenv("DB_USER", "postgres")
        pwd = os.getenv("POSTGRES_PASSWORD") or os.getenv("DB_PASSWORD", "postgres")
        name = os.getenv("POSTGRES_DB") or os.getenv("DB_NAME", "worklog")
        url = f"postgresql://{user}:{pwd}@{host}:{port}/{name}"

    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)

    kwargs = {}
    db_ssl = (
        os.getenv("DB_SSL", "").lower() in ("true", "1")
        or "sslmode=require" in url
        or "neon.tech" in url
        or "supabase.co" in url
    )
    if db_ssl and "sslmode" not in url:
        kwargs["sslmode"] = "require"

    return psycopg2.connect(url, **kwargs)


def table_exists(cur, table_name):
    """Check if table exists in public schema."""
    cur.execute(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = %s)",
        (table_name,),
    )
    return cur.fetchone()["exists"]


def export_worklog(conn, target_email=None, target_user_id=None):
    """Export all relevant data for users."""
    import psycopg2.extras

    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        # Check available tables
        has_companies = table_exists(cur, "companies")
        has_skills = table_exists(cur, "skills")
        has_tags = table_exists(cur, "tags")
        has_log_tags = table_exists(cur, "log_tags")
        has_work_logs = table_exists(cur, "work_logs")
        has_resumes = table_exists(cur, "resumes")

        user_query = "SELECT id, username, email, full_name, theme_preference, created_at, updated_at FROM users"
        user_params = []
        conditions = []

        if target_email:
            conditions.append("LOWER(email) = LOWER(%s)")
            user_params.append(target_email.strip())
        if target_user_id:
            conditions.append("id = %s")
            user_params.append(target_user_id)

        if conditions:
            user_query += " WHERE " + " AND ".join(conditions)
        user_query += " ORDER BY id ASC"

        cur.execute(user_query, tuple(user_params))
        users = cur.fetchall()

        if not users:
            return None

        export_data = {
            "version": "1.0",
            "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "source": "workLog",
            "users": [],
        }

        total_logs = 0
        total_companies = 0
        total_skills = 0
        total_resumes = 0

        for u in users:
            uid = u["id"]

            # 1. Companies
            companies = []
            company_map = {}
            if has_companies:
                cur.execute(
                    """
                    SELECT id, name, color, is_current, job_title, location, start_month, end_month, created_at
                    FROM companies
                    WHERE user_id = %s
                    ORDER BY id ASC
                    """,
                    (uid,),
                )
                companies = cur.fetchall()
                company_map = {c["id"]: c["name"] for c in companies}
                total_companies += len(companies)

            # 2. Skills
            skills = []
            if has_skills:
                cur.execute(
                    """
                    SELECT id, name, category, proficiency, years_experience, last_used_year, is_active, created_at, updated_at
                    FROM skills
                    WHERE user_id = %s
                    ORDER BY category ASC, name ASC
                    """,
                    (uid,),
                )
                skills = cur.fetchall()
                total_skills += len(skills)

            # 3. Tags
            tags = []
            if has_tags:
                cur.execute(
                    """
                    SELECT id, name, color, created_at
                    FROM tags
                    WHERE user_id = %s
                    ORDER BY name ASC
                    """,
                    (uid,),
                )
                tags = cur.fetchall()

            # 4. Work Logs with attached Tags and Company Name
            work_logs = []
            if has_work_logs:
                if has_log_tags and has_tags:
                    cur.execute(
                        """
                        SELECT
                            wl.id,
                            TO_CHAR(wl.log_date, 'YYYY-MM-DD') AS log_date,
                            wl.title,
                            wl.content_markdown,
                            wl.status,
                            wl.blockers,
                            wl.achievements,
                            wl.company_id,
                            wl.created_at,
                            wl.updated_at,
                            COALESCE(
                                ARRAY_AGG(t.name) FILTER (WHERE t.id IS NOT NULL),
                                ARRAY[]::varchar[]
                            ) AS tags
                        FROM work_logs wl
                        LEFT JOIN log_tags lt ON wl.id = lt.log_id
                        LEFT JOIN tags t ON lt.tag_id = t.id
                        WHERE wl.user_id = %s
                        GROUP BY wl.id
                        ORDER BY wl.log_date DESC, wl.created_at DESC
                        """,
                        (uid,),
                    )
                else:
                    cur.execute(
                        """
                        SELECT
                            id,
                            TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date,
                            title,
                            content_markdown,
                            status,
                            blockers,
                            achievements,
                            company_id,
                            created_at,
                            updated_at,
                            ARRAY[]::varchar[] AS tags
                        FROM work_logs
                        WHERE user_id = %s
                        ORDER BY log_date DESC, created_at DESC
                        """,
                        (uid,),
                    )
                raw_logs = cur.fetchall()
                for log in raw_logs:
                    cid = log.get("company_id")
                    log["company_name"] = company_map.get(cid) if cid else None
                    work_logs.append(log)
                total_logs += len(work_logs)

            # 5. Resumes
            resumes = []
            if has_resumes:
                cur.execute(
                    """
                    SELECT id, title, target_role, content_markdown, model, created_at
                    FROM resumes
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    """,
                    (uid,),
                )
                resumes = cur.fetchall()
                total_resumes += len(resumes)

            user_entry = {
                "profile": u,
                "companies": companies,
                "skills": skills,
                "tags": tags,
                "work_logs": work_logs,
                "resumes": resumes,
            }
            export_data["users"].append(user_entry)

        export_data["summary"] = {
            "total_users": len(users),
            "total_companies": total_companies,
            "total_skills": totalSkills,
            "total_work_logs": total_logs,
            "total_resumes": total_resumes,
        }

        return export_data


def main():
    parser = argparse.ArgumentParser(description="Export WorkLog data to JSON.")
    parser.add_argument("--db-url", "--database-url", dest="db_url", default=None, help="PostgreSQL connection string")
    parser.add_argument("--email", default=None, help="Filter export to a specific user email")
    parser.add_argument("--user-id", type=int, default=None, help="Filter export to a specific user ID")
    parser.add_argument("-o", "--output", default=None, help="Output JSON file path (prints to stdout if omitted)")
    args = parser.parse_args()

    try:
        conn = get_db_connection(args.db_url)
    except Exception as err:
        sys.stderr.write(f"Error connecting to database: {err}\n")
        sys.exit(1)

    try:
        data = export_worklog(conn, target_email=args.email, target_user_id=args.user_id)
        if not data or not data["users"]:
            sys.stderr.write("No matching users or data found to export.\n")
            sys.exit(1)

        json_text = json.dumps(data, cls=CustomJSONEncoder, indent=2, ensure_ascii=False)

        if args.output:
            out_path = os.path.abspath(args.output)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(json_text)
                f.write("\n")
            sys.stderr.write(
                f"✓ Successfully exported data to: {out_path}\n"
                f"  Users: {data['summary']['total_users']}, "
                f"Companies: {data['summary']['total_companies']}, "
                f"Skills: {data['summary']['total_skills']}, "
                f"Work Logs: {data['summary']['total_work_logs']}, "
                f"Resumes: {data['summary']['total_resumes']}\n"
            )
        else:
            print(json_text)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
