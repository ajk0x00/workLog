# 📝 WorkLog — Modern Minimalist Daily Work Journal

A sleek, modern, distraction-free application to log end-of-shift work, track task checklists and handovers, maintain streaks, and automatically generate daily standup summaries.

---

## 🐘 Connecting to an External PostgreSQL Database

You can connect WorkLog to any external PostgreSQL database (Cloud SQL, Neon, Supabase, AWS RDS, Render, Railway, ElephantSQL, etc.) using a standard connection string.

### Step 1: Set your `DATABASE_URL` in [`.env`](file:///Users/ajk/personal/workLog/.env)

```env
# Example for Neon / Supabase / Render:
DATABASE_URL=postgresql://user:password@ep-xyz.us-east-1.aws.neon.tech/worklog?sslmode=require

# Example for GCP Cloud SQL / AWS RDS:
DATABASE_URL=postgresql://postgres:your_password@34.120.x.x:5432/worklog

# Enable SSL for cloud database providers
DB_SSL=true

# Set port to 80 for direct HTTP access (http://your-vm-ip)
APP_PORT=80
```

### Step 2: Start the Application Container

```bash
docker compose up --build -d
```

> **Note**: WorkLog automatically executes database schema initialization on startup. You do **not** need to manually run any DDL or migration scripts—tables (`users`, `work_logs`, `tags`, `log_tags`) and indexes are created automatically.

---

## 🚀 Running on a GCP VM

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url> worklog && cd worklog
   ```

2. **Configure `.env`**:
   ```bash
   cp .env.example .env
   nano .env
   ```
   Paste your external `DATABASE_URL` and set `APP_PORT=80`.

3. **Launch with Docker Compose**:
   ```bash
   docker compose up --build -d
   ```

4. Open your browser at **`http://<GCP_VM_IP>`**.

---

## 🛠️ Local Development (without Docker)

```bash
# 1. Install dependencies
npm install
cd client && npm install && cd ..

# 2. Build and start dev server
npm run dev
```
- App: `http://localhost:5173`
- API Backend: `http://localhost:3000`
