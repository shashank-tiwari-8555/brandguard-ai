# Inkloom AI – Production Deployment Guide

This guide details the complete production deployment procedure for the **Inkloom AI** platform:
- **Frontend**: [Vercel](https://vercel.com/) (React 19 + Vite SPA)
- **Backend**: [Render](https://render.com/) (FastAPI + Uvicorn + RapidOCR)
- **AI Engine**: Groq API (`openai/gpt-oss-120b`)
- **Database**: SQLite (`backend/inkloom.db`) with production persistence guidance

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │            Vercel Frontend             │
                      │         React 19 + Vite (SPA)          │
                      │  https://<your-project>.vercel.app     │
                      └───────────────────┬────────────────────┘
                                          │
                                          │ HTTPS (VITE_API_BASE_URL)
                                          ▼
                      ┌────────────────────────────────────────┐
                      │             Render Backend             │
                      │            FastAPI + Uvicorn           │
                      │  https://<your-service>.onrender.com   │
                      └───────────┬────────────────┬───────────┘
                                  │                │
                         Internal │                │ HTTPS
                                  ▼                ▼
                      ┌──────────────────────┐ ┌───────────────┐
                      │        SQLite        │ │   Groq API    │
                      │ (Persistent Storage) │ │ (gpt-oss-120b)│
                      └──────────────────────┘ └───────────────┘
```

---

## 2. Backend Deployment on Render

### Method A: Automated Deployment via Blueprint (`render.yaml`) (Recommended)
1. Push your repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
3. Connect your `Inkloom-AI` repository.
4. Render will automatically detect `render.yaml` and configure:
   - **Service Name**: `inkloom-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/health`
5. Under Environment Variables, supply your **`GROQ_API_KEY`** (`gsk_...`).
6. Click **Apply**.

---

### Method B: Manual Web Service Setup
1. Log in to [Render](https://dashboard.render.com/) and click **New +** → **Web Service**.
2. Select your repository: `Inkloom-AI`.
3. Configure the following parameters:

| Field | Configuration Value | Notes |
| :--- | :--- | :--- |
| **Name** | `inkloom-backend` | Unique identifier for your service |
| **Region** | Oregon (US West) or Frankfurt (EU) | Select region closest to your users |
| **Branch** | `main` | Production branch |
| **Root Directory** | `backend` | Sets build context inside `backend/` |
| **Runtime** | `Python 3` | Python runtime |
| **Build Command** | `pip install -r requirements.txt` | Installs pinned backend packages |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` | Binds to dynamic `$PORT` and `0.0.0.0` |
| **Instance Type** | Free (or Starter if attaching Disk) | See Section 4 for SQLite guidance |

4. **Environment Variables**:
   Under the **Environment** tab, add:

   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `GROQ_API_KEY` | `gsk_...` | **Required**: API key from [Groq Console](https://console.groq.com) |
   | `PYTHON_VERSION` | `3.13.0` | Recommended Python version |
   | `CORS_ORIGINS` | `https://*.vercel.app,http://localhost:5173` | Allowed frontend origins |
   | `DATABASE_PATH` | `/var/data/inkloom.db` | Optional: Path to persistent disk mount |

5. **Health Check Path**:
   Under **Advanced Settings**, set **Health Check Path** to `/health`.

6. Click **Create Web Service**. Note your deployed URL (e.g., `https://inkloom-backend.onrender.com`).

---

## 3. Frontend Deployment on Vercel

### Step 1: Import Project into Vercel
1. Log in to [Vercel](https://vercel.com/) and click **Add New...** → **Project**.
2. Choose your `Inkloom-AI` repository.

### Step 2: Configure Project Settings
In the configuration screen:

| Setting | Value | Why It Matters |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Auto-detects Vite configuration |
| **Root Directory** | Click **Edit** → select `frontend` | **Crucial**: Must point to `frontend` directory |
| **Build Command** | `npm run build` | Bundles CSS and JS into `dist/` |
| **Output Directory** | `dist` | Default Vite build directory |
| **Install Command** | `npm install` | Installs dependencies |

### Step 3: Configure Environment Variables
Add the centralized backend URL:

| Key | Value Example | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://inkloom-backend.onrender.com` | Public URL of your deployed Render backend (omit trailing slash) |

> [!NOTE]
> `frontend/vercel.json` already contains single-page app rewrite rules (`{"rewrites": [{"source": "/(.*)", "destination": "/"}]}`) to ensure client-side routing works on refresh.

### Step 4: Deploy
Click **Deploy**. Once built, Vercel will assign a public domain (e.g. `https://inkloom-ai.vercel.app`).

---

## 4. Database Strategy & Render SQLite Evaluation

### Current Local Setup: SQLite (`backend/inkloom.db`)
- **Status**: 100% persistent on local machine with 47 verified analysis records and active **Be10X** Brand Guidelines.
- **Reliability**: Uses SQLite with connection pooling, transactional rollbacks, and schema idempotency (`CREATE TABLE IF NOT EXISTS`, `INSERT OR IGNORE`).

### Render SQLite Limitations & Persistence Analysis
> [!WARNING]
> On Render's **Free tier**, instances run on an **ephemeral disk**. When a free instance sleeps after 15 minutes of inactivity or restarts during a redeploy, any changes written to container disk will be lost.

### Recommended Production Persistence Solutions

#### Option 1: Render Persistent Disk (Safest for SQLite)
- **Tier**: Render Starter ($7/mo) + Persistent Disk ($0.25/mo per GB).
- **Mount Path**: Mount a 1 GB disk at `/var/data`.
- **Configuration**: Set environment variable `DATABASE_PATH=/var/data/inkloom.db`.
- **Benefit**: Retains all existing SQLite code, queries, and zero schema migration needed.

#### Option 2: Managed Cloud PostgreSQL (e.g. Supabase / Neon / Render Postgres)
- **Tier**: Free tier available on Supabase or Neon.
- **Benefit**: Multi-instance concurrency, automated backups, web dashboard.
- **Implementation**: Swap `sqlite3` connection manager with `psycopg2` or `asyncpg` when scaling beyond single-instance.

---

## 5. Security & Secret Safeguards

1. **`GROQ_API_KEY` Protection**:
   - `GROQ_API_KEY` is read strictly server-side in `backend/main.py` via `os.getenv("GROQ_API_KEY")`.
   - Never referenced in Vite frontend code or exposed in `window` object.
   - Bundled production JS assets contain zero API keys or credentials.
2. **Git Exclusions**:
   - `.env`, `backend/.env`, `frontend/.env`, and `backend/inkloom.db` are strictly excluded in `.gitignore`.
   - Zero sensitive credentials are committed to Git.

---

## 6. Pre-Deployment Verification Commands

Run these local checks to verify deployment readiness:

```bash
# 1. Frontend Linter & Production Build
cd frontend
npm run lint           # Result: 0 warnings, 0 errors
npm run build          # Result: Built cleanly in dist/

# 2. Backend Compilation
cd ../backend
python3 -m py_compile main.py qa_test_suite.py   # Result: 0 errors

# 3. Backend End-to-End Test Suite
python3 qa_test_suite.py                         # Result: 12/12 tests PASSED
```

---

## 7. Post-Deployment Verification Steps

1. **Test Backend Health Endpoint**:
   ```bash
   curl -s https://<your-render-backend>.onrender.com/health
   # Expected response: {"status": "healthy", "groq_configured": true}
   ```

2. **Test Brand Guidelines Endpoint**:
   ```bash
   curl -s https://<your-render-backend>.onrender.com/brand-guidelines
   # Expected response: {"status": "success", "guidelines": {...}}
   ```

3. **Verify Frontend UI in Browser**:
   - Open `https://<your-vercel-app>.vercel.app` in your browser.
   - Verify active brand pill indicates the configured brand profile.
   - Run a test ad in **Content Analyzer** (both text mode and poster image mode).
   - Confirm analysis results display risk scores, flagged violations, and suggested revisions.
   - Confirm new analysis appears in **Approval Center** and **History**.
