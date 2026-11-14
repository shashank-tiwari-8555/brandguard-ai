# Inkloom AI

### Intelligent Advertisement Verification & Brand Governance Platform

Inkloom AI is an enterprise-grade AI governance platform that helps businesses evaluate advertisement copy and promotional poster imagery, detect non-compliant or misleading claims, enforce customized brand guidelines, and generate brand-aligned revisions with human-in-the-loop approvals.

---

## 1. Problem Statement

In modern digital marketing, advertisements frequently suffer from:
- **Misleading Promises & Absolute Guarantees**: Unsubstantiated claims (e.g., *"100% guaranteed"*, *"zero risk"*).
- **Unverified Superiority Claims**: Vague superlative statements (e.g., *"world's best"*, *"#1 rated platform"*) without benchmark citations.
- **Artificial Urgency & Deceptive Discounts**: Fake countdowns, manufactured scarcity, and misleading discount references.
- **Brand Identity Drift**: Inconsistent tone of voice, prohibited terms, off-brand messaging, and missing mandatory disclaimers.

Enterprise marketing and legal teams require an automated, reliable system to audit advertising materials before publication while keeping humans in the loop.

---

## 2. Platform Architecture

```
                       ┌────────────────────────────┐
                       │     Inkloom React SPA      │
                       │    React 19 + Vite + CSS   │
                       └─────────────┬──────────────┘
                                     │ HTTPS / JSON & Multipart
                                     ▼
                       ┌────────────────────────────┐
                       │      FastAPI Backend       │
                       │     Uvicorn ASGI Gateway   │
                       └──────┬──────────────┬──────┘
                              │              │
                   OCR Stream │              │ Prompt & Context
                              ▼              ▼
                      ┌──────────────┐ ┌──────────────┐
                      │   RapidOCR   │ │   Groq AI    │
                      │(ONNX Runtime)│ │(gpt-oss-120b)│
                      └──────┬───────┘ └──────┬───────┘
                             │ Extracted Text │ Verified Claims
                             └───────┬────────┘
                                     │
                                     ▼
                             ┌──────────────┐
                             │  SQLite DB   │
                             │ (inkloom.db) │
                             └──────────────┘
```

---

## 3. Key Capabilities

### 1. Dual-Mode Content Analyzer
- **Text Copy Analysis**: Real-time evaluation of headlines, ad scripts, email promos, and campaign copy. Includes one-click sample prompts (*High-Risk Guarantee*, *Artificial Urgency & Claims*, *Balanced Compliant Ad*).
- **Poster & Image Analysis**: Drag-and-drop file upload supporting **PNG**, **JPG/JPEG**, and **WEBP** (up to 10 MB). Uses **RapidOCR** (ONNX Runtime) to extract visible advertising text directly from posters and passes it through the compliance pipeline. Transparently discloses OCR attribution and text-only LLM capabilities.

### 2. Brand Guidelines Governance
Enforces 9 dimensions of brand identity configured dynamically in SQLite:
1. **Brand Name**
2. **Brand Description & Mission**
3. **Tone of Voice** (e.g. Authoritative, empathetic, transparent)
4. **Target Audience & Customer Personas**
5. **Preferred Words & Phrases** (Injected into AI revisions)
6. **Prohibited Terminology & Blacklists** (High-severity violation triggers)
7. **Writing Rules & Editorial Standards** (e.g. Active voice, concise sentences)
8. **Visual Guidelines & Identity Specifications**
9. **Additional Brand Rules & Legal Disclaimers**

### 3. Truth-in-Advertising & Compliance Engine
Identifies deterministic and AI-evaluated violations:
- **Unrealistic Guarantees**: Absolute promises requiring empirical evidence.
- **Unsubstantiated Superiority**: Claims of being "#1" or "the best" without comparative evidence.
- **Numerical Performance Claims**: Statistics that require cited benchmarks.
- **Unverified Social Proof**: Dubious user counts or popularity figures.
- **Artificial Urgency**: Manufactured deadlines and pressure tactics.
- **Unverified Discounts**: Unsubstantiated price reductions or promotional terms.

### 4. AI-Powered Suggested Revisions
- Rewrites flagged copy into an honest, compliant, and persuasive alternative.
- Weaves in approved brand vocabulary while eliminating prohibited phrases and deceptive claims.
- Never invents fake statistics, user figures, or offer conditions.

### 5. Human-in-the-Loop Compliance Approval Center
- High-risk and medium-risk advertisements are queued for human review.
- Side-by-side comparison of original ad copy vs. AI suggested revision.
- Dedicated **✓ Approve for Publication** and **✕ Reject Copy** actions.

### 6. Executive Dashboard & Governance History
- High-level KPIs: Total Analyses, Compliance Health Rate, Issues Detected, and Pending Approvals Queue.
- Visual compliance risk distribution bar (High / Medium / Low).
- Searchable and filterable audit trail across all historical evaluations.

### 7. System Diagnostics & Settings
- Live status checks for the FastAPI gateway, Groq AI engine, and SQLite database storage.
- Active CORS whitelists and environment runtime parameters.

---

## 4. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite 8 | Single-page application, custom dark enterprise SaaS UI |
| **Icons** | Custom Lucide-style SVGs | Zero-dependency, lightweight, React 19 compatible |
| **Backend** | FastAPI, Uvicorn | High-performance Python ASGI REST API |
| **AI / LLM** | Groq Cloud (`openai/gpt-oss-120b`) | Ultra-fast brand governance analysis and copy rewriting |
| **OCR Engine** | RapidOCR + ONNX Runtime, Pillow | Local in-memory text extraction from poster images |
| **Database** | SQLite 3 (`inkloom.db`) | Transactional persistence for brand rules and audit history |
| **Testing & Lint** | Oxlint, Vite Build, Pytest/TestClient | Sub-100ms builds and zero-warning verification |

---

## 5. API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check and Groq AI connectivity verification |
| `GET` | `/brand-guidelines` | Fetch saved brand guidelines profile |
| `PUT` | `/brand-guidelines` | Update and sync brand guidelines with AI reasoning |
| `POST` | `/analyze` | Analyze advertisement text copy |
| `POST` | `/analyze-image` | Upload and analyze an advertisement poster (`multipart/form-data`) |
| `GET` | `/history` | Retrieve full history of evaluated advertisements |
| `GET` | `/approvals` | Retrieve queue of pending compliance approvals |
| `PATCH` | `/approvals/{id}` | Approve or reject an advertisement record |

---

## 6. Local Development Setup

### Prerequisites
- **Python 3.10+** (Python 3.13 recommended)
- **Node.js 18+** & **npm**
- **Groq API Key** (from [console.groq.com](https://console.groq.com))

### 1. Clone the Repository
```bash
git clone https://github.com/shashank-tiwari-8555/brandguard-ai.git
cd Inkloom-AI
```

### 2. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env and insert your GROQ_API_KEY:
# GROQ_API_KEY=gsk_...

# Start the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Backend will be live at `http://127.0.0.1:8000` (Docs available at `/docs`).

### 3. Frontend Setup
```bash
cd ../frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Frontend will be live at `http://localhost:5173`.

---

## 7. Production Deployment

Inkloom AI is pre-configured for instant cloud deployment:
- **Frontend**: Deploy on [Vercel](https://vercel.com/) with root directory set to `frontend` and environment variable `VITE_API_BASE_URL` pointing to your deployed backend.
- **Backend**: Deploy on [Render](https://render.com/) with root directory set to `backend`, start command `uvicorn main:app --host 0.0.0.0 --port $PORT`, and environment variables `GROQ_API_KEY` and `CORS_ORIGINS`.

Refer to [`DEPLOYMENT.md`](DEPLOYMENT.md) for complete step-by-step production instructions.

---

## 8. Quality Assurance & Testing

```bash
# Frontend Linter (Oxlint)
cd frontend && npm run lint

# Frontend Production Build
cd frontend && npm run build

# Backend Compilation Check
cd backend && python -m py_compile main.py
```

---

## 9. Team & Project Information

- **Team Name**: Detached HEAD
- **Team Leader**: Shashank Tiwari
- **Team Member**: Kiran Billur
- **Project Purpose**: Developing an AI-powered solution that promotes responsible advertising, strengthens brand governance, and protects customer trust.
