#!/usr/bin/env python3
"""Export all WorkLog data to a JSON dump for migration to careerTrack.

Runs directly with standard Python 3 WITHOUT requiring Docker, virtual environments,
or external dependencies (psycopg2, etc.).

It automatically reads database connection settings from the project's .env file.
If running outside Docker and DATABASE_URL points to a Docker hostname (e.g. 'db'),
it automatically resolves to 'localhost'.

Usage:
    # Basic export using .env credentials (saves to worklog_export.json)
    python3 scripts/export_data.py -o worklog_export.json

    # Stream JSON directly to stdout
    python3 scripts/export_data.py > worklog_export.json

    # Export a specific user by email
    python3 scripts/export_data.py --email alex@example.com -o user_export.json

    # Override database URL
    python3 scripts/export_data.py --db-url "postgresql://postgres:postgres@localhost:5432/worklog" -o dump.json
"""

import argparse
import base64
import datetime
import decimal
import hashlib
import hmac
import json
import os
import re
import socket
import ssl
import struct
import subprocess
import sys
import urllib.parse


# ==============================================================================
# 1. Environment and Configuration Loading (.env)
# ==============================================================================

def load_env(env_path=None):
    """Load .env file into a dictionary (pure Python, zero dependencies)."""
    candidates = []
    if env_path:
        candidates.append(os.path.abspath(env_path))
    candidates.extend([
        os.path.join(os.getcwd(), ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"),
    ])

    env_vars = {}
    loaded_from = None
    for path in candidates:
        if os.path.isfile(path):
            loaded_from = path
            try:
                with open(path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"):
                            continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            k = k.strip()
                            v = v.strip().strip("'\"")
                            env_vars[k] = v
                break
            except Exception:
                pass

    return env_vars, loaded_from


def get_db_config(env_vars, cli_db_url=None):
    """Resolve database connection parameters from CLI or .env."""
    url = cli_db_url or os.environ.get("DATABASE_URL") or env_vars.get("DATABASE_URL")

    if url:
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)

        parsed = urllib.parse.urlparse(url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 5432
        user = parsed.username or "postgres"
        password = urllib.parse.unquote(parsed.password or "")
        db_name = parsed.path.lstrip("/") or "worklog"

        qs = urllib.parse.parse_qs(parsed.query)
        use_ssl = (
            qs.get("sslmode", [""])[0] == "require"
            or qs.get("ssl", [""])[0] in ("true", "1")
            or "sslmode=require" in url
            or "neon.tech" in url
            or "supabase.co" in url
            or env_vars.get("DB_SSL", "").lower() in ("true", "1")
        )
    else:
        host = (
            env_vars.get("POSTGRES_SERVER")
            or env_vars.get("DB_HOST")
            or os.environ.get("POSTGRES_SERVER")
            or "localhost"
        )
        port = int(
            env_vars.get("POSTGRES_PORT")
            or env_vars.get("DB_PORT")
            or os.environ.get("POSTGRES_PORT")
            or 5432
        )
        user = (
            env_vars.get("POSTGRES_USER")
            or env_vars.get("DB_USER")
            or os.environ.get("POSTGRES_USER")
            or "postgres"
        )
        password = (
            env_vars.get("POSTGRES_PASSWORD")
            or env_vars.get("DB_PASSWORD")
            or os.environ.get("POSTGRES_PASSWORD")
            or "postgres"
        )
        db_name = (
            env_vars.get("POSTGRES_DB")
            or env_vars.get("DB_NAME")
            or os.environ.get("POSTGRES_DB")
            or "worklog"
        )
        use_ssl = env_vars.get("DB_SSL", "").lower() in ("true", "1")

    # Smart Docker hostname resolution: if host is 'db' or 'host.docker.internal'
    # and cannot be resolved, fall back to localhost (for running outside Docker)
    if host in ("db", "host.docker.internal"):
        try:
            socket.getaddrinfo(host, port)
        except socket.gaierror:
            sys.stderr.write(
                f"[Info] Hostname '{host}' cannot be resolved outside Docker. Connecting to 'localhost' instead.\n"
            )
            host = "localhost"

    return {
        "host": host,
        "port": port,
        "user": user,
        "password": password,
        "database": db_name,
        "ssl": use_ssl,
        "raw_url": url,
    }


# ==============================================================================
# 2. Pure-Python Lightweight PostgreSQL Client (Zero Dependencies)
# ==============================================================================

class PurePythonPGClient:
    """Minimal pure-Python client for PostgreSQL protocol 3.0.

    Supports Cleartext, MD5, and SCRAM-SHA-256 authentication.
    """

    def __init__(self, host, port, user, password, database, use_ssl=False):
        self.host = host
        self.port = int(port)
        self.user = user
        self.password = password
        self.database = database
        self.use_ssl = use_ssl
        self.sock = None

    def connect(self):
        s = socket.create_connection((self.host, self.port), timeout=15)

        if self.use_ssl:
            # SSL request packet: length 8, code 80877103
            s.sendall(struct.pack("!II", 8, 80877103))
            ssl_resp = s.recv(1)
            if ssl_resp == b"S":
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                s = context.wrap_socket(s, server_hostname=self.host)
            elif ssl_resp != b"N":
                raise ConnectionError(f"Unexpected SSL negotiation response: {ssl_resp}")

        self.sock = s
        self._startup()

    def _recv_exact(self, length):
        buf = bytearray()
        while len(buf) < length:
            chunk = self.sock.recv(length - len(buf))
            if not chunk:
                raise ConnectionError("Connection closed unexpectedly by server.")
            buf.extend(chunk)
        return bytes(buf)

    def _startup(self):
        # Startup packet: length (4), protocol 3.0 (4: 196608), key-value params
        params = (
            b"user\x00"
            + self.user.encode("utf-8")
            + b"\x00database\x00"
            + self.database.encode("utf-8")
            + b"\x00client_encoding\x00UTF8\x00\x00"
        )
        packet = struct.pack("!II", 8 + len(params), 196608) + params
        self.sock.sendall(packet)

        while True:
            mtype = self._recv_exact(1)
            mlen = struct.unpack("!I", self._recv_exact(4))[0]
            body = self._recv_exact(mlen - 4)

            if mtype == b"R":  # Authentication
                auth_code = struct.unpack("!I", body[:4])[0]
                if auth_code == 0:  # AuthenticationOk
                    continue
                elif auth_code == 3:  # CleartextPassword
                    pw_body = self.password.encode("utf-8") + b"\x00"
                    self.sock.sendall(b"p" + struct.pack("!I", 4 + len(pw_body)) + pw_body)
                elif auth_code == 5:  # MD5Password
                    salt = body[4:8]
                    inner = hashlib.md5((self.password + self.user).encode("utf-8")).hexdigest()
                    res = "md5" + hashlib.md5(inner.encode("utf-8") + salt).hexdigest() + "\x00"
                    pw_body = res.encode("ascii")
                    self.sock.sendall(b"p" + struct.pack("!I", 4 + len(pw_body)) + pw_body)
                elif auth_code == 10:  # AuthenticationSASL (SCRAM-SHA-256)
                    self._handle_scram()
                else:
                    raise ConnectionError(f"Unsupported authentication code: {auth_code}")
            elif mtype == b"E":  # ErrorResponse
                err_msg = body.decode("utf-8", errors="replace")
                raise ConnectionError(f"PostgreSQL authentication error: {err_msg}")
            elif mtype == b"Z":  # ReadyForQuery
                break

    def _handle_scram(self):
        client_nonce = base64.b64encode(os.urandom(18)).decode("ascii")
        client_first_bare = f"n={self.user},r={client_nonce}"
        client_first = f"n,,{client_first_bare}"
        sasl_initial = (
            b"SCRAM-SHA-256\x00"
            + struct.pack("!I", len(client_first))
            + client_first.encode("utf-8")
        )
        self.sock.sendall(b"p" + struct.pack("!I", 4 + len(sasl_initial)) + sasl_initial)

        # Server-first
        self._recv_exact(1)  # 'R'
        srv_len = struct.unpack("!I", self._recv_exact(4))[0]
        struct.unpack("!I", self._recv_exact(4))  # 11: AuthenticationSASLContinue
        server_first = self._recv_exact(srv_len - 8).decode("utf-8")

        parts = dict(p.split("=", 1) for p in server_first.split(","))
        server_nonce = parts["r"]
        salt = base64.b64decode(parts["s"])
        iterations = int(parts["i"])

        client_final_without_proof = f"c=biws,r={server_nonce}"
        auth_msg = f"{client_first_bare},{server_first},{client_final_without_proof}".encode("utf-8")

        salted_password = hashlib.pbkdf2_hmac("sha256", self.password.encode("utf-8"), salt, iterations)
        client_key = hmac.new(salted_password, b"Client Key", hashlib.sha256).digest()
        stored_key = hashlib.sha256(client_key).digest()
        client_sig = hmac.new(stored_key, auth_msg, hashlib.sha256).digest()
        proof = bytes(a ^ b for a, b in zip(client_key, client_sig))
        proof_b64 = base64.b64encode(proof).decode("ascii")

        client_final = f"{client_final_without_proof},p={proof_b64}".encode("utf-8")
        self.sock.sendall(b"p" + struct.pack("!I", 4 + len(client_final)) + client_final)

        # Server-final
        self._recv_exact(1)  # 'R'
        sfin_len = struct.unpack("!I", self._recv_exact(4))[0]
        struct.unpack("!I", self._recv_exact(4))  # 12: AuthenticationSASLFinal
        self._recv_exact(sfin_len - 8)

        # AuthenticationOk
        self._recv_exact(1)  # 'R'
        struct.unpack("!I", self._recv_exact(4))
        ok_code = struct.unpack("!I", self._recv_exact(4))[0]
        if ok_code != 0:
            raise ConnectionError(f"SCRAM Authentication failed with code {ok_code}")

    def query(self, sql):
        """Execute a simple query and return rows as list of dicts."""
        q_bytes = sql.encode("utf-8") + b"\x00"
        self.sock.sendall(b"Q" + struct.pack("!I", 4 + len(q_bytes)) + q_bytes)

        cols = []
        rows = []

        while True:
            mtype = self._recv_exact(1)
            mlen = struct.unpack("!I", self._recv_exact(4))[0]
            body = self._recv_exact(mlen - 4)

            if mtype == b"T":  # RowDescription
                cols = []
                num_fields = struct.unpack("!H", body[:2])[0]
                offset = 2
                for _ in range(num_fields):
                    idx = body.index(b"\x00", offset)
                    col_name = body[offset:idx].decode("utf-8")
                    cols.append(col_name)
                    offset = idx + 1 + 4 + 2 + 4 + 2 + 4 + 2  # Skip type metadata
            elif mtype == b"D":  # DataRow
                num_fields = struct.unpack("!H", body[:2])[0]
                offset = 2
                row = {}
                for idx in range(num_fields):
                    col_len = struct.unpack("!i", body[offset:offset+4])[0]
                    offset += 4
                    col_name = cols[idx]
                    if col_len == -1:
                        row[col_name] = None
                    else:
                        val = body[offset:offset+col_len].decode("utf-8", errors="replace")
                        offset += col_len
                        row[col_name] = val
                rows.append(row)
            elif mtype == b"E":  # ErrorResponse
                raise RuntimeError(f"Database query error: {body.decode('utf-8', errors='replace')}")
            elif mtype == b"Z":  # ReadyForQuery
                break

        return rows

    def close(self):
        if self.sock:
            try:
                # Terminate message
                self.sock.sendall(b"X\x00\x00\x00\x04")
                self.sock.close()
            except Exception:
                pass


# ==============================================================================
# 3. Universal Database Execution Layer
# ==============================================================================

class UniversalDB:
    """Connects to Postgres using available drivers: psycopg2 -> psql -> pure Python."""

    def __init__(self, config):
        self.config = config
        self.driver = None
        self.psycopg_conn = None
        self.pure_client = None

    def connect(self):
        # 1. Try psycopg2 if installed
        try:
            import psycopg2
            import psycopg2.extras
            kwargs = {}
            if self.config["ssl"]:
                kwargs["sslmode"] = "require"
            url = self.config["raw_url"]
            if url and self.config["host"] == "localhost" and "@db:" in url:
                url = url.replace("@db:", "@localhost:", 1)

            if url:
                self.psycopg_conn = psycopg2.connect(url, **kwargs)
            else:
                self.psycopg_conn = psycopg2.connect(
                    host=self.config["host"],
                    port=self.config["port"],
                    user=self.config["user"],
                    password=self.config["password"],
                    dbname=self.config["database"],
                    **kwargs,
                )
            self.driver = "psycopg2"
            return
        except ImportError:
            pass
        except Exception as e:
            sys.stderr.write(f"[Driver psycopg2 failed: {e}. Trying fallback...]\n")

        # 2. Try pure Python socket client (zero dependencies)
        try:
            client = PurePythonPGClient(
                host=self.config["host"],
                port=self.config["port"],
                user=self.config["user"],
                password=self.config["password"],
                database=self.config["database"],
                use_ssl=self.config["ssl"],
            )
            client.connect()
            self.pure_client = client
            self.driver = "pure_python"
            return
        except Exception as e:
            sys.stderr.write(f"[Pure Python connector failed: {e}. Trying psql fallback...]\n")

        # 3. Try psql CLI if installed
        try:
            env = os.environ.copy()
            env["PGPASSWORD"] = self.config["password"]
            res = subprocess.run(
                [
                    "psql",
                    "-h", self.config["host"],
                    "-p", str(self.config["port"]),
                    "-U", self.config["user"],
                    "-d", self.config["database"],
                    "-t", "-A", "-c", "SELECT 1;",
                ],
                env=env,
                capture_output=True,
                text=True,
            )
            if res.returncode == 0:
                self.driver = "psql"
                return
        except Exception:
            pass

        raise ConnectionError(
            f"Could not connect to PostgreSQL at {self.config['host']}:{self.config['port']}/{self.config['database']}.\n"
            "Please check that PostgreSQL is running and credentials in .env are correct."
        )

    def query(self, sql):
        if self.driver == "psycopg2":
            import psycopg2.extras
            with self.psycopg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(sql)
                return cur.fetchall()
        elif self.driver == "pure_python":
            return self.pure_client.query(sql)
        elif self.driver == "psql":
            env = os.environ.copy()
            env["PGPASSWORD"] = self.config["password"]
            wrapper = f"SELECT json_agg(t) FROM ({sql}) t;"
            res = subprocess.run(
                [
                    "psql",
                    "-h", self.config["host"],
                    "-p", str(self.config["port"]),
                    "-U", self.config["user"],
                    "-d", self.config["database"],
                    "-t", "-A", "-c", wrapper,
                ],
                env=env,
                capture_output=True,
                text=True,
            )
            if res.returncode != 0:
                raise RuntimeError(res.stderr)
            out = res.stdout.strip()
            return json.loads(out) if out else []

    def close(self):
        if self.psycopg_conn:
            self.psycopg_conn.close()
        if self.pure_client:
            self.pure_client.close()


# ==============================================================================
# 4. Data Extraction & Formatting
# ==============================================================================

def cast_bool(val):
    if val is None:
        return False
    if isinstance(val, bool):
        return val
    return str(val).strip().lower() in ("t", "true", "1", "yes")

def cast_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except Exception:
        return None

def cast_float(val):
    if val is None:
        return None
    try:
        return float(val)
    except Exception:
        return None


def export_all(db, target_email=None, target_user_id=None):
    """Fetch all workLog entities and assemble export payload."""
    # Check tables
    chk_tables = db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
    )
    existing_tables = set(r["table_name"] for r in chk_tables)

    has_companies = "companies" in existing_tables
    has_skills = "skills" in existing_tables
    has_tags = "tags" in existing_tables
    has_log_tags = "log_tags" in existing_tables
    has_work_logs = "work_logs" in existing_tables
    has_resumes = "resumes" in existing_tables

    user_sql = "SELECT id, username, email, full_name, theme_preference, created_at, updated_at FROM users"
    conditions = []
    if target_email:
        escaped_email = target_email.strip().lower().replace("'", "''")
        conditions.append(f"LOWER(email) = '{escaped_email}'")
    if target_user_id:
        conditions.append(f"id = {int(target_user_id)}")

    if conditions:
        user_sql += " WHERE " + " AND ".join(conditions)
    user_sql += " ORDER BY id ASC;"

    raw_users = db.query(user_sql)
    if not raw_users:
        return None

    export_payload = {
        "version": "1.0",
        "exported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source": "workLog",
        "users": [],
    }

    total_companies = 0
    total_skills = 0
    total_logs = 0
    total_resumes = 0

    for u in raw_users:
        uid = int(u["id"])
        user_profile = {
            "id": uid,
            "username": u.get("username"),
            "email": u.get("email"),
            "full_name": u.get("full_name"),
            "theme_preference": u.get("theme_preference"),
            "created_at": str(u.get("created_at") or ""),
            "updated_at": str(u.get("updated_at") or ""),
        }

        # 1. Companies
        companies = []
        comp_map = {}
        if has_companies:
            comp_rows = db.query(
                f"""
                SELECT id, name, color, is_current, job_title, location, start_month, end_month, created_at
                FROM companies
                WHERE user_id = {uid}
                ORDER BY id ASC;
                """
            )
            for c in comp_rows:
                cid = int(c["id"])
                c_obj = {
                    "id": cid,
                    "name": c.get("name"),
                    "color": c.get("color"),
                    "is_current": cast_bool(c.get("is_current")),
                    "job_title": c.get("job_title"),
                    "location": c.get("location"),
                    "start_month": c.get("start_month"),
                    "end_month": c.get("end_month"),
                    "created_at": str(c.get("created_at") or ""),
                }
                companies.append(c_obj)
                comp_map[cid] = c_obj["name"]
            total_companies += len(companies)

        # 2. Skills
        skills = []
        if has_skills:
            skill_rows = db.query(
                f"""
                SELECT id, name, category, proficiency, years_experience, last_used_year, is_active, created_at, updated_at
                FROM skills
                WHERE user_id = {uid}
                ORDER BY category ASC, name ASC;
                """
            )
            for s in skill_rows:
                skills.append({
                    "id": int(s["id"]),
                    "name": s.get("name"),
                    "category": s.get("category"),
                    "proficiency": cast_int(s.get("proficiency")),
                    "years_experience": cast_float(s.get("years_experience")),
                    "last_used_year": cast_int(s.get("last_used_year")),
                    "is_active": cast_bool(s.get("is_active")),
                    "created_at": str(s.get("created_at") or ""),
                    "updated_at": str(s.get("updated_at") or ""),
                })
            total_skills += len(skills)

        # 3. Tags
        tags = []
        if has_tags:
            tag_rows = db.query(
                f"""
                SELECT id, name, color, created_at
                FROM tags
                WHERE user_id = {uid}
                ORDER BY name ASC;
                """
            )
            for t in tag_rows:
                tags.append({
                    "id": int(t["id"]),
                    "name": t.get("name"),
                    "color": t.get("color"),
                    "created_at": str(t.get("created_at") or ""),
                })

        # 4. Work Logs
        work_logs = []
        if has_work_logs:
            # Query logs
            log_rows = db.query(
                f"""
                SELECT id, TO_CHAR(log_date, 'YYYY-MM-DD') AS log_date, title, content_markdown,
                       status, blockers, achievements, company_id, created_at, updated_at
                FROM work_logs
                WHERE user_id = {uid}
                ORDER BY log_date DESC, created_at DESC;
                """
            )

            # Query tag mapping for user's logs
            tag_map = {}
            if has_log_tags and has_tags and log_rows:
                log_ids_str = ",".join(str(r["id"]) for r in log_rows)
                lt_rows = db.query(
                    f"""
                    SELECT lt.log_id, t.name
                    FROM log_tags lt
                    JOIN tags t ON lt.tag_id = t.id
                    WHERE lt.log_id IN ({log_ids_str});
                    """
                )
                for r in lt_rows:
                    lid = int(r["log_id"])
                    tag_map.setdefault(lid, []).append(r["name"])

            for l in log_rows:
                lid = int(l["id"])
                cid = cast_int(l.get("company_id"))
                work_logs.append({
                    "id": lid,
                    "log_date": l.get("log_date"),
                    "title": l.get("title"),
                    "content_markdown": l.get("content_markdown") or "",
                    "status": l.get("status") or "done",
                    "blockers": l.get("blockers") or "",
                    "achievements": l.get("achievements") or "",
                    "company_id": cid,
                    "company_name": comp_map.get(cid) if cid else None,
                    "tags": tag_map.get(lid, []),
                    "created_at": str(l.get("created_at") or ""),
                    "updated_at": str(l.get("updated_at") or ""),
                })
            total_logs += len(work_logs)

        # 5. Resumes
        resumes = []
        if has_resumes:
            res_rows = db.query(
                f"""
                SELECT id, title, target_role, content_markdown, model, created_at
                FROM resumes
                WHERE user_id = {uid}
                ORDER BY created_at DESC;
                """
            )
            for r in res_rows:
                resumes.append({
                    "id": int(r["id"]),
                    "title": r.get("title"),
                    "target_role": r.get("target_role"),
                    "content_markdown": r.get("content_markdown") or "",
                    "model": r.get("model"),
                    "created_at": str(r.get("created_at") or ""),
                })
            total_resumes += len(resumes)

        export_payload["users"].append({
            "profile": user_profile,
            "companies": companies,
            "skills": skills,
            "tags": tags,
            "work_logs": work_logs,
            "resumes": resumes,
        })

    export_payload["summary"] = {
        "total_users": len(raw_users),
        "total_companies": total_companies,
        "total_skills": total_skills,
        "total_work_logs": total_logs,
        "total_resumes": total_resumes,
    }

    return export_payload


# ==============================================================================
# 5. CLI Entrypoint
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Export WorkLog data to JSON using .env configuration (runs without Docker)."
    )
    parser.add_argument("-o", "--output", default="worklog_export.json", help="Output file path (default: worklog_export.json)")
    parser.add_argument("--stdout", action="store_true", help="Print JSON directly to stdout instead of saving to file")
    parser.add_argument("-e", "--email", default=None, help="Filter export to a single user email")
    parser.add_argument("-u", "--user-id", type=int, default=None, help="Filter export to a single user ID")
    parser.add_argument("--env-file", default=None, help="Path to custom .env file")
    parser.add_argument("--db-url", default=None, help="Explicit database URL (overrides .env)")

    args = parser.parse_args()

    env_vars, env_file = load_env(args.env_file)
    if env_file:
        sys.stderr.write(f"[Config] Loaded settings from: {env_file}\n")
    else:
        sys.stderr.write("[Config] No .env file found, using defaults / environment variables.\n")

    config = get_db_config(env_vars, args.db_url)
    sys.stderr.write(
        f"[Target] PostgreSQL {config['user']}@{config['host']}:{config['port']}/{config['database']} "
        f"(SSL: {'enabled' if config['ssl'] else 'disabled'})\n"
    )

    db = UniversalDB(config)
    try:
        db.connect()
        sys.stderr.write(f"[Connection] Established using driver: {db.driver}\n")
    except Exception as e:
        sys.stderr.write(f"\n[Error] {e}\n")
        sys.exit(1)

    try:
        data = export_all(db, target_email=args.email, target_user_id=args.user_id)
        if not data or not data["users"]:
            sys.stderr.write("[Warning] No matching users or data found to export.\n")
            sys.exit(1)

        json_output = json.dumps(data, indent=2, ensure_ascii=False)

        if args.stdout:
            print(json_output)
        else:
            out_file = os.path.abspath(args.output)
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(json_output)
                f.write("\n")
            sys.stderr.write(
                f"\n✓ Successfully exported {data['summary']['total_users']} user(s) to:\n  {out_file}\n"
                f"  Summary: {data['summary']['total_companies']} companies, "
                f"{data['summary']['total_skills']} skills, "
                f"{data['summary']['total_work_logs']} work logs, "
                f"{data['summary']['total_resumes']} resumes.\n"
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
