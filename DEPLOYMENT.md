# Inkloom AI – Production Deployment Guide

This guide details the deployment procedure for the **Inkloom AI** platform across **Render** (FastAPI Backend) and **Vercel** (React + Vite Frontend).

---

## 1. Architecture Overview

```
                      ┌────────────────────────────┐
                      │       Vercel Frontend      │
                      │  React 19 + Vite (SPA)     │
                      └─────────────┬──────────────┘
                                    │ HTTPS (API Requests)
                                    ▼
                      ┌────────────────────────────┐
                      │       Render Backend       │
                      │   FastAPI + Uvicorn        │
                      └──────┬──────────────┬──────┘
                             │              │
                    Internal │              │ HTTPS
                             ▼              ▼
                     ┌──────────────┐ ┌──────────────┐
                     │ SQLite / DB  │ │   Groq API   │
                     │ (inkloom.db) │ │ (gpt-oss-120b│
                     └──────────────┘ └──────────────┘
```

---

## 2. Backend Deployment on Render

### Step 1: Create a New Web Service
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository: `Inkloom-AI`.

### Step 2: Configure Service Settings
| Setting | Recommended Value | Notes |
| :--- | :--- | :--- |
| **Name** | `inkloom-backend` | Or any unique name |
| **Region** | Oregon (US West) or Frankfurt (EU) | Choose nearest to your users |
| **Branch** | `main` | Production branch |
| **Root Directory** | `backend` | Sets execution context to `backend/` |
| **Runtime** | `Python 3` | |
| **Build Command** | `pip install -r requirements.txt` | Installs pinned packages |
| **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` | Binds to Render's dynamic `$PORT` |
| **Instance Type** | Free (or Starter with Disk) | See Database considerations below |

### Step 3: Configure Backend Environment Variables
Under the **Environment** section in Render, add the following key-value pairs:

| Variable | Value / Description | Required? |
| :--- | :--- | :---: |
| `GROQ_API_KEY` | `gsk_...` (Your Groq API key from console.groq.com) | **Yes** |
| `PYTHON_VERSION` | `3.13.0` | Recommended |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app` (Your Vercel URL) | Recommended |
| `DATABASE_PATH` | `/var/data/inkloom.db` (Only if using Render Persistent Disk) | Optional |

### Step 4: Health Check Configuration
* Under **Advanced**, set **Health Check Path** to:
  ```
  /health
  ```
  Render will poll this endpoint to confirm successful deployment before routing traffic.

---

## 3. Frontend Deployment on Vercel

### Step 1: Import Project into Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** → **Project**.
3. Select the `Inkloom-AI` repository.

### Step 2: Configure Project Settings
| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Framework Preset** | `Vite` | Auto-detected |
| **Root Directory** | Click **Edit** → select `frontend` | **Crucial**: Must point to `frontend` |
| **Build Command** | `npm run build` | Default |
| **Output Directory** | `dist` | Default |
| **Install Command** | `npm install` | Default |

### Step 3: Configure Frontend Environment Variables
In the **Environment Variables** section on Vercel:

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://inkloom-backend.onrender.com` | The public URL of your deployed Render backend (no trailing slash) |

Click **Deploy**.

---

## 4. Database Strategy & Storage Evaluation

### Current State: SQLite (`backend/inkloom.db`)
* **Reliability on Local / Single Process**: Fast, zero setup, robust ACID transactions.
* **Limitation on Render Free Tier**:
  > [!WARNING]
  > Render Free tier web services use an **ephemeral disk**. When the service sleeps after 15 minutes of inactivity or redeploys, any new records saved to `inkloom.db` on container storage will be reset to the state in the repository.

### Recommended Storage Solutions (No Migration Performed Yet)

1. **Option A: Render Web Service with Persistent Disk (Recommended for SQLite)**
   * Upgrade Render service to paid tier ($7/month) and attach a **Persistent Disk** (1 GB = $0.25/month) mounted at `/var/data`.
   * Set `DATABASE_PATH=/var/data/inkloom.db` in Render environment variables.
   * Keeps the existing SQLite code and queries 100% unchanged.

2. **Option B: Managed Cloud PostgreSQL (e.g. Supabase / Neon / Render Postgres)**
   * Free persistent tier with automatic backups and multi-instance concurrency.
   * Matches the original project specification in `README.md` (`Database: Supabase`).
   * Can be migrated cleanly in Milestone 3 with zero schema loss.

---

## 5. Pre-Deployment Verification Checklist

Run these commands locally prior to committing:

```bash
# 1. Frontend validation
cd frontend
npm run lint          # Must output: 0 warnings, 0 errors
npm run build         # Must output: ✓ built in XXms

# 2. Backend validation
cd ../backend
./venv/bin/python -m py_compile main.py   # Must exit with code 0

# 3. Startup and health check test
PYTHONPATH=. ./venv/bin/python -c "
import urllib.request, uvicorn, threading, time, os
from main import app
config = uvicorn.Config(app, host='0.0.0.0', port=8012)
server = uvicorn.Server(config)
thread = threading.Thread(target=server.run, daemon=True)
thread.start()
time.sleep(1.5)
res = urllib.request.urlopen('http://127.0.0.1:8012/health')
print('Health test:', res.status)
assert res.status == 200
server.should_exit = True
"
```

---

## 6. Post-Deployment Verification

1. Open `https://<your-render-service>.onrender.com/health` in your browser:
   * Expect: `{"status": "healthy", "groq_configured": true}`
2. Open `https://<your-vercel-app>.vercel.app`:
   * Navigate to **Brand Guidelines** and verify the active brand profile loads.
   * Navigate to **Content Analyzer** and run an advertisement analysis.
   * Verify the result renders and can be viewed in **Approvals** and **History**.

