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
| **Instance Type** | Starter (required for Persistent Disk) | See Section 4 for SQLite persistent disk details |

4. **Environment Variables**:
   Under the **Environment** tab, add:

   | Key | Value | Description |
   | :--- | :--- | :--- |
   | `GROQ_API_KEY` | `gsk_...` | **Required**: API key from [Groq Console](https://console.groq.com) |
   | `PYTHON_VERSION` | `3.13.0` | Recommended Python version |
   | `CORS_ORIGINS` | `https://*.vercel.app,http://localhost:5173` | Allowed frontend origins |
   | `DATABASE_PATH` | `/var/data/inkloom.db` | Path to persistent disk mount (Starter plan with Persistent Disk) |

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

## 4. Persistent SQLite Storage on Render

### Overview
Inkloom AI uses an embedded SQLite database. In development, it defaults to `backend/inkloom.db`. In production on Render, Web Services default to ephemeral containers where any file written outside of an attached disk is discarded during service redeploys or sleep cycles.

To ensure **100% data persistence** in production without rewriting SQLite code or migrating to an external database, Inkloom AI supports **Render Persistent Disks** via the `DATABASE_PATH` environment variable.

---

### Step 1: Render Persistent Disk Configuration

Persistent Disks require Render's **Starter** plan ($7/mo) and cost **$0.25/GB/month** (1 GB is more than sufficient for thousands of analyses).

#### Automated via `render.yaml` (Blueprint)
The repository includes a ready-to-use `render.yaml` specification:
```yaml
services:
  - type: web
    name: inkloom-backend
    runtime: python
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    autoDeploy: true
    plan: starter
    disk:
      name: inkloom-data
      mountPath: /var/data
      sizeGB: 1
    envVars:
      - key: DATABASE_PATH
        value: /var/data/inkloom.db
```

#### Manual Configuration (Dashboard)
If setting up manually through the Render Dashboard:
1. Navigate to your Web Service (`inkloom-backend`) → **Disks** tab.
2. Click **Add Disk**:
   - **Name**: `inkloom-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB`
3. Navigate to the **Environment** tab:
   - Add `DATABASE_PATH` = `/var/data/inkloom.db`
4. Click **Save Changes**. Render will redeploy the service with the attached persistent disk.

---

### Step 2: Safe Transfer of Existing Local Database to Render

To preserve your existing analysis history, approval decisions (e.g. Analysis #42 Approved, #44 Rejected), and configured brand guidelines (e.g. Be10X), transfer `backend/inkloom.db` to the `/var/data/` persistent mount using either of the following methods.

#### Option A: Transfer via Render Dashboard Web Shell (Quickest, No SSH setup needed)

1. **On your local machine**, generate a Base64-encoded string of the database:
   ```bash
   # macOS:
   base64 -i backend/inkloom.db -o db_b64.txt
   
   # Linux:
   base64 backend/inkloom.db > db_b64.txt
   ```

2. **Open Render Dashboard**:
   - Go to your `inkloom-backend` service.
   - Click the **Shell** tab on the left navigation to open the interactive terminal.

3. **In the Render Shell**, decode the file directly into `/var/data/inkloom.db`:
   ```bash
   mkdir -p /var/data
   cat << 'EOF' | base64 -d > /var/data/inkloom.db
   <PASTE_BASE64_STRING_FROM_db_b64.txt_HERE>
   EOF
   chmod 644 /var/data/inkloom.db
   ```

4. **Verify the database inside Render Shell**:
   ```bash
   python3 -c "
   import sqlite3
   conn = sqlite3.connect('/var/data/inkloom.db')
   c = conn.cursor()
   analyses = c.execute('SELECT count(*) FROM analyses').fetchone()[0]
   brand = c.execute('SELECT brand_name FROM brand_guidelines WHERE id = 1').fetchone()[0]
   print(f'✅ Verification SUCCESS: {analyses} analyses found, active brand: \"{brand}\"')
   "
   ```

---

#### Option B: Direct File Transfer via Render SSH / SCP

1. In Render Dashboard, go to **Account Settings** → **SSH Keys** and add your local machine's public SSH key (`cat ~/.ssh/id_ed25519.pub` or `cat ~/.ssh/id_rsa.pub`).
2. Go to your `inkloom-backend` service → click **Connect** → copy the SSH connection string (e.g. `srv-xxxx@ssh.oregon.render.com`).
3. From your local machine terminal, copy the database directly:
   ```bash
   scp backend/inkloom.db srv-xxxx@ssh.oregon.render.com:/var/data/inkloom.db
   ```
4. Verify via SSH:
   ```bash
   ssh srv-xxxx@ssh.oregon.render.com "python3 -c \"import sqlite3; conn=sqlite3.connect('/var/data/inkloom.db'); print('Analyses:', conn.execute('SELECT count(*) FROM analyses').fetchone()[0])\""
   ```

---

### Step 3: Automated Initialization (Zero-Data / Fresh Setup)

If you do not transfer the local database, Inkloom AI's backend automatically creates and initializes a schema-identical database at `/var/data/inkloom.db` on first boot:
- Automatically creates parent directories (`mkdir(parents=True, exist_ok=True)`).
- Initializes tables `analyses` and `brand_guidelines` via idempotent `CREATE TABLE IF NOT EXISTS`.
- Applies any missing column migrations (`analysis_mode`, `image_filename`, `ocr_extracted_text`, `processing_engine`).
- Seeds default `brand_guidelines` record (`id=1`) via `INSERT OR IGNORE`.

---

### Step 4: Production SQLite Concurrency Optimization

The backend connection manager in `backend/main.py` is pre-configured with production concurrency guards:
```python
# WAL mode allows concurrent readers and a writer simultaneously:
connection.execute("PRAGMA journal_mode=WAL;")
# Busy timeout avoids 'database is locked' errors during simultaneous API requests:
connection.execute("PRAGMA busy_timeout=5000;")
# 20.0s connection timeout for reliable lock acquisition:
sqlite3.connect(db_file, timeout=20.0)
```

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
