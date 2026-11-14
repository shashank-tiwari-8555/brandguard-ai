
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
from contextlib import contextmanager
from pathlib import Path
from datetime import datetime, timezone
from dotenv import load_dotenv
from groq import Groq

import sqlite3
import json
import re
import os
import io
import uuid
import shutil
import logging

try:
    from rapidocr_onnxruntime import RapidOCR
    ocr_engine = RapidOCR()
except Exception:
    ocr_engine = None


# ==========================================
# 1. FASTAPI CONFIGURATION
# ==========================================

app = FastAPI(title="Inkloom AI API")

# Default local origins plus dynamic environment-configured origins (e.g. Vercel URL)
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

env_cors = os.getenv("CORS_ORIGINS") or os.getenv("ALLOWED_ORIGINS") or ""
custom_cors_origins = [origin.strip() for origin in env_cors.split(",") if origin.strip()]
ALLOWED_ORIGINS = list(dict.fromkeys(DEFAULT_CORS_ORIGINS + custom_cors_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ==========================================
# 2. GROQ AI CONFIGURATION
# ==========================================

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY not found in backend/.env. AI features will use rule-based fallback.")
    client = None
else:
    client = Groq(api_key=GROQ_API_KEY)

GROQ_MODEL = "openai/gpt-oss-120b"


# ==========================================
# 3. DATABASE CONFIGURATION
# ==========================================

def get_db_path() -> Path:
    """
    Returns the resolved SQLite database path.
    - Default (local dev): backend/inkloom.db
    - Production (Render): Configurable via DATABASE_PATH (e.g. /var/data/inkloom.db)
    Ensures parent directory exists before establishing connection.
    """
    env_path = os.getenv("DATABASE_PATH")
    if env_path and env_path.strip():
        target = Path(env_path.strip()).resolve()
    else:
        target = (BASE_DIR / "inkloom.db").resolve()

    try:
        target.parent.mkdir(parents=True, exist_ok=True)
    except Exception as dir_err:
        logger.warning(f"Could not create database parent directory {target.parent}: {dir_err}")

    return target


DB_PATH = get_db_path()


@contextmanager
def get_db_connection():
    """
    Context manager providing a transactional SQLite connection with:
    - Row factory as sqlite3.Row
    - 20.0s connection timeout for concurrent queries
    - WAL journal mode for optimal concurrent read/write performance
    - Automatic commit on success, rollback on error
    """
    db_file = get_db_path()
    connection = sqlite3.connect(db_file, timeout=20.0)
    connection.row_factory = sqlite3.Row

    try:
        connection.execute("PRAGMA journal_mode=WAL;")
        connection.execute("PRAGMA busy_timeout=5000;")
    except Exception:
        pass

    try:
        yield connection
        connection.commit()

    except Exception:
        connection.rollback()
        raise

    finally:
        connection.close()


def get_uploads_dir() -> Path:
    """
    Returns the persistent uploads directory for advertisement images.
    - If UPLOADS_DIR environment variable is set: use it
    - Else if DATABASE_PATH is set (e.g. /var/data/inkloom.db): use get_db_path().parent / "uploads" (/var/data/uploads)
    - Default local dev: BASE_DIR / "uploads" (backend/uploads)
    Ensures directory exists.
    """
    env_dir = os.getenv("UPLOADS_DIR")
    if env_dir and env_dir.strip():
        target = Path(env_dir.strip()).resolve()
    else:
        db_parent = get_db_path().parent
        target = (db_parent / "uploads").resolve()

    try:
        target.mkdir(parents=True, exist_ok=True)
    except Exception as dir_err:
        logger.warning(f"Could not create uploads directory {target}: {dir_err}")

    return target


UPLOADS_DIR = get_uploads_dir()


def init_db():

    with get_db_connection() as connection:

        # Existing analysis database
        connection.execute("""
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                original_content TEXT NOT NULL,
                risk_score INTEGER,
                risk_level TEXT,
                total_issues INTEGER,
                issues_json TEXT,
                suggested_revision TEXT,
                approval_status TEXT DEFAULT 'Pending',
                created_at TEXT
            )
        """)

        # Add image & metadata columns if they do not exist
        analysis_columns = [col[1] for col in connection.execute("PRAGMA table_info(analyses)").fetchall()]
        if "analysis_mode" not in analysis_columns:
            connection.execute("ALTER TABLE analyses ADD COLUMN analysis_mode TEXT DEFAULT 'text'")
        if "image_filename" not in analysis_columns:
            connection.execute("ALTER TABLE analyses ADD COLUMN image_filename TEXT DEFAULT ''")
        if "image_path" not in analysis_columns:
            connection.execute("ALTER TABLE analyses ADD COLUMN image_path TEXT DEFAULT ''")
        if "ocr_extracted_text" not in analysis_columns:
            connection.execute("ALTER TABLE analyses ADD COLUMN ocr_extracted_text TEXT DEFAULT ''")
        if "processing_engine" not in analysis_columns:
            connection.execute("ALTER TABLE analyses ADD COLUMN processing_engine TEXT DEFAULT ''")

        # Graceful backfill: if sample images exist in frontend/public/samples, copy to uploads and link existing sample records
        try:
            uploads_dir = get_uploads_dir()
            frontend_samples = (BASE_DIR.parent / "frontend" / "public" / "samples").resolve()
            if frontend_samples.exists():
                for sample_file in frontend_samples.glob("*.png"):
                    dest = uploads_dir / sample_file.name
                    if not dest.exists():
                        shutil.copy2(sample_file, dest)
                connection.execute("""
                    UPDATE analyses 
                    SET image_path = image_filename 
                    WHERE (image_path IS NULL OR image_path = '') 
                    AND image_filename IN ('sample_promo_poster.png', 'sample_compliant_poster.png')
                """)
        except Exception as backfill_err:
            logger.debug(f"Sample asset backfill skipped: {backfill_err}")

        # Brand Guidelines database
        connection.execute("""
            CREATE TABLE IF NOT EXISTS brand_guidelines (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                brand_name TEXT DEFAULT '',
                brand_description TEXT DEFAULT '',
                tone_of_voice TEXT DEFAULT '',
                target_audience TEXT DEFAULT '',
                preferred_words TEXT DEFAULT '',
                prohibited_words TEXT DEFAULT '',
                writing_rules TEXT DEFAULT '',
                visual_guidelines TEXT DEFAULT '',
                additional_rules TEXT DEFAULT '',
                updated_at TEXT
            )
        """)

        # Create default brand profile
        connection.execute("""
            INSERT OR IGNORE INTO brand_guidelines (
                id,
                updated_at
            )
            VALUES (1, ?)
        """, (
            datetime.now(timezone.utc).isoformat(),
        ))


init_db()


# ==========================================
# 4. REQUEST MODELS
# ==========================================

class AnalysisRequest(BaseModel):
    content: str = Field(min_length=1)


class ApprovalRequest(BaseModel):
    status: Literal["Approved", "Rejected"]


class BrandGuidelinesRequest(BaseModel):

    brand_name: str = ""
    brand_description: str = ""
    tone_of_voice: str = ""
    target_audience: str = ""
    preferred_words: str = ""
    prohibited_words: str = ""
    writing_rules: str = ""
    visual_guidelines: str = ""
    additional_rules: str = ""


# ==========================================
# 5. BRAND GUIDELINES HELPERS
# ==========================================

BRAND_GUIDELINE_FIELDS = [
    "brand_name",
    "brand_description",
    "tone_of_voice",
    "target_audience",
    "preferred_words",
    "prohibited_words",
    "writing_rules",
    "visual_guidelines",
    "additional_rules"
]


def get_saved_brand_guidelines():

    with get_db_connection() as connection:

        row = connection.execute("""
            SELECT *
            FROM brand_guidelines
            WHERE id = 1
        """).fetchone()

    if row is None:
        return {
            field: ""
            for field in BRAND_GUIDELINE_FIELDS
        }

    return {
        field: row[field] or ""
        for field in BRAND_GUIDELINE_FIELDS
    }


def build_brand_guidelines_prompt(guidelines):

    sections = []

    labels = {
        "brand_name": "Brand name",
        "brand_description": "Brand description",
        "tone_of_voice": "Tone of voice",
        "target_audience": "Target audience",
        "preferred_words": "Preferred words or phrases",
        "prohibited_words": "Words or phrases to avoid",
        "writing_rules": "Writing rules",
        "visual_guidelines": "Visual identity guidelines",
        "additional_rules": "Additional brand rules"
    }

    for field in BRAND_GUIDELINE_FIELDS:

        value = guidelines.get(field, "")

        if value and value.strip():

            sections.append(
                f"{labels[field]}: {value.strip()}"
            )

    if not sections:

        return (
            "No custom brand guidelines have been saved. "
            "Follow the general honesty, transparency and "
            "non-fabrication rules in this system prompt."
        )

    return "\n".join(sections)


# ==========================================
# 5B. OCR TEXT EXTRACTION ENGINE
# ==========================================

def extract_text_from_image_bytes(image_bytes: bytes) -> tuple[str, list[dict], str]:
    """
    Extracts visible advertisement text from image bytes using RapidOCR.
    Returns: (full_extracted_text, detailed_lines, status_message)
    """
    if not ocr_engine:
        logger.warning("RapidOCR engine is not initialized.")
        return "", [], "OCR engine unavailable"

    try:
        results, elapse = ocr_engine(image_bytes)
        if not results:
            return "", [], "No text detected in image"

        lines = []
        full_text_parts = []

        for item in results:
            # item structure: [box_coordinates, text, confidence]
            text = (item[1] or "").strip()
            confidence = float(item[2]) if len(item) > 2 else 0.0

            if text:
                lines.append({
                    "text": text,
                    "confidence": round(confidence, 3)
                })
                full_text_parts.append(text)

        full_text = " \n".join(full_text_parts)
        return full_text, lines, "success"

    except Exception as e:
        logger.exception("RapidOCR text extraction failed.")
        return "", [], f"OCR extraction error: {str(e)}"


# ==========================================
# 6. GROQ AI BRAND GOVERNANCE AND REWRITING
# ==========================================

def extract_json_response(raw_text: str) -> dict:

    text = (raw_text or "").strip()

    if "```" in text:
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    match = re.search(r"(\{.*\})", text, re.DOTALL)
    candidate = match.group(1) if match else text

    try:
        return json.loads(candidate)
    except Exception:
        pass

    # Remove trailing commas before closing braces/brackets
    cleaned = re.sub(r",\s*([\}\]])", r"\1", candidate)
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    return json.loads(text)


def merge_compliance_issues(rule_issues: list, ai_issues: list) -> list:

    merged = list(rule_issues)

    for ai_issue in ai_issues:

        ai_claim = (ai_issue.get("claim") or "").strip().lower()
        ai_type = (ai_issue.get("type") or "").strip().lower()

        matched = False

        for r_issue in merged:

            r_claim = (r_issue.get("claim") or "").strip().lower()
            r_type = (r_issue.get("type") or "").strip().lower()

            if ai_claim and r_claim and (ai_claim in r_claim or r_claim in ai_claim):

                if (
                    ai_type == r_type
                    or ("prohibit" in ai_type and "prohibit" in r_type)
                    or ("guarantee" in ai_type and "guarantee" in r_type)
                    or ("superior" in ai_type and "superior" in r_type)
                ):
                    if len(ai_issue.get("explanation", "")) > len(r_issue.get("explanation", "")):
                        r_issue["explanation"] = ai_issue["explanation"]

                    if ai_issue.get("recommendation"):
                        r_issue["recommendation"] = ai_issue["recommendation"]

                    matched = True
                    break

        if not matched:

            sev = str(ai_issue.get("severity", "Medium")).capitalize()
            if sev not in ["High", "Medium", "Low"]:
                sev = "Medium"

            merged.append({
                "type": str(ai_issue.get("type") or "Brand Guideline Violation"),
                "claim": str(ai_issue.get("claim") or "General ad copy"),
                "explanation": str(ai_issue.get("explanation") or "Violates active brand guidelines."),
                "severity": sev,
                "recommendation": str(ai_issue.get("recommendation") or "Review and align with brand guidelines.")
            })

    return merged


def analyze_with_groq_and_rewrite(
    content: str,
    guidelines: dict,
    rule_issues: list
) -> tuple[list, str, str]:

    if not client or not GROQ_API_KEY:
        logger.info("Groq client not configured; using transparent rule-based fallback.")
        brand_name = (guidelines.get("brand_name") or "").strip() or "Our product"
        fallback_revision = (
            f"{brand_name} is designed to help customers achieve their goals through reliable, "
            "transparent solutions. Performance and results may vary depending on individual circumstances. "
            "Please review the applicable product information and offer terms."
        )
        return [], fallback_revision, "Rule-based fallback"

    brand_guidelines_text = build_brand_guidelines_prompt(guidelines)

    has_custom_guidelines = any(
        (guidelines.get(field) or "").strip()
        for field in BRAND_GUIDELINE_FIELDS
    )

    if has_custom_guidelines:

        guidelines_section = f"""ACTIVE BRAND GUIDELINES:
{brand_guidelines_text}

EVALUATION CRITERIA:
1. Brand Tone of Voice: Check if the advertisement voice reflects the saved tone of voice and avoid forbidden or conflicting tones (e.g. hype, aggressive, sensational, pushy, casual vs formal).
2. Target Audience Alignment: Ensure messaging is appropriately framed for the specified target audience and personas.
3. Vocabulary Governance:
   - Identify any prohibited words, blacklisted phrases, or forbidden claims.
   - Note if preferred words or approved phrases should be integrated.
4. Writing Rules: Verify compliance with specified writing standards, sentence structure, active voice, and verification requirements.
5. Visual Identity Guidelines: Check references to visual elements, brand colors, typography, or styling for compliance where applicable.
6. Additional Brand Rules: Verify all mandatory disclaimers, trademark notices, and special compliance rules.
7. Truth-in-Advertising Standards: Detect unrealistic guarantees, unverified superiority, unverified performance statistics, artificial urgency, and unverified discounts.
8. Risk vs Deception Distinction: Distinguish potentially risky claims (e.g. comparative or performance claims that lack cited benchmark proof; assign Medium or Low severity) from outright deceptive, impossible, or prohibited claims (e.g. absolute guarantees, zero-risk claims, or explicitly blacklisted vocabulary; assign High severity)."""

    else:

        guidelines_section = """BRAND GUIDELINES:
No custom brand guidelines have been configured. Apply standard truth-in-advertising and fair marketing principles:
1. Identify unsupported absolute guarantees (e.g., "100% guarantee", "zero risk", "never fail").
2. Identify unverified superiority claims (e.g., "#1", "world's best", "leading product").
3. Identify unverified numerical performance claims and statistics.
4. Identify artificial urgency and unverified discount claims.
5. Ensure a professional, transparent, and trustworthy tone.
6. Distinguish potentially risky claims (requiring benchmark evidence) from outright false or prohibited promises."""

    system_prompt = f"""You are an expert advertisement compliance and brand governance assistant working for Inkloom AI.

Your task is to analyze advertisement copy for compliance with brand guidelines and truth-in-advertising regulations, identify all issues with clear explanations, and generate a corrected suggested revision.

{guidelines_section}

STRICT INSTRUCTIONS:
1. Analyze the advertisement text thoroughly against all the above criteria.
2. For each detected brand violation or compliance issue, return:
   - "type": Category (e.g. "Tone of Voice Mismatch", "Prohibited Brand Term", "Target Audience Disconnect", "Writing Rule Violation", "Visual Guideline Issue", "Brand Rule Violation", "Unrealistic Guarantee", "Unsubstantiated Superiority Claim", "Unsubstantiated Performance Claim", "Artificial Urgency", or "Unverified Discount Claim").
   - "claim": Exact excerpt from the advertisement.
   - "explanation": Clear, detailed explanation specifically citing the brand guideline or compliance rule violated.
   - "severity": "High", "Medium", or "Low".
   - "recommendation": Actionable correction guidance based on brand guidelines.
3. Provide a "suggested_revision" that rewrites the advertisement into an honest, persuasive, and brand-aligned version. It must:
   - Strictly follow the brand tone, target audience, and writing rules.
   - Incorporate preferred words and phrases naturally.
   - Purge all prohibited words, false guarantees, and unverified claims.
   - Never fabricate statistics, user counts, or offer terms.
4. If the advertisement is already fully compliant and matches all brand guidelines, return an empty "issues" list and return the advertisement as the suggested_revision.
5. Return ONLY a valid JSON object matching this structure with no markdown wrapper or extra text:
{{
  "issues": [
    {{
      "type": "string",
      "claim": "string",
      "explanation": "string",
      "severity": "High",
      "recommendation": "string"
    }}
  ],
  "suggested_revision": "string"
}}"""

    user_prompt = f"""Analyze the following advertisement copy:

ORIGINAL ADVERTISEMENT:
\"\"\"{content}\"\"\"

PRE-DETECTED RULE-BASED FLAGS:
{json.dumps([{"type": i["type"], "claim": i["claim"]} for i in rule_issues], indent=2)}

Perform a complete brand governance evaluation and return the JSON object."""

    try:

        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": user_prompt
                }
            ],
            temperature=0.2,
            max_completion_tokens=4000
        )

        response_content = completion.choices[0].message.content

        if not response_content or not response_content.strip():
            raise ValueError("Groq returned an empty response.")

        parsed = extract_json_response(response_content)
        ai_issues = parsed.get("issues", [])
        suggested_revision = (parsed.get("suggested_revision") or "").strip()

        if not suggested_revision:
            raise ValueError("Groq did not provide a suggested revision.")

        valid_ai_issues = []
        for issue in ai_issues:
            if isinstance(issue, dict) and "claim" in issue and "explanation" in issue:
                sev = str(issue.get("severity", "Medium")).capitalize()
                if sev not in ["High", "Medium", "Low"]:
                    sev = "Medium"
                valid_ai_issues.append({
                    "type": str(issue.get("type", "Brand Guideline Violation")),
                    "claim": str(issue.get("claim", "")),
                    "explanation": str(issue.get("explanation", "")),
                    "severity": sev,
                    "recommendation": str(issue.get("recommendation", "Align with brand guidelines."))
                })

        return valid_ai_issues, suggested_revision, "Groq AI"

    except Exception:

        logger.exception("Groq advertisement analysis/rewriting failed.")

        brand_name = (guidelines.get("brand_name") or "").strip() or "Our product"
        fallback_revision = (
            f"{brand_name} is designed to help customers achieve their goals through reliable, "
            "transparent solutions. Performance and results may vary depending on individual circumstances. "
            "Please review the applicable product information and offer terms."
        )

        return [], fallback_revision, "Rule-based fallback"


def generate_suggested_revision(content, issues):

    guidelines = get_saved_brand_guidelines()
    _, revision, source = analyze_with_groq_and_rewrite(content, guidelines, issues)
    return revision, source


# ==========================================
# 7. HOME AND HEALTH ROUTES
# ==========================================

@app.get("/")
def home():

    return {
        "message": "Welcome to Inkloom AI Backend!",
        "status": "Running successfully"
    }


@app.get("/health")
def health():

    return {
        "status": "healthy",
        "groq_configured": bool(GROQ_API_KEY)
    }


# ==========================================
# 8. BRAND GUIDELINES API
# ==========================================

@app.get("/brand-guidelines")
def get_brand_guidelines():

    guidelines = get_saved_brand_guidelines()

    with get_db_connection() as connection:

        row = connection.execute("""
            SELECT updated_at
            FROM brand_guidelines
            WHERE id = 1
        """).fetchone()

    return {
        "status": "success",
        "guidelines": guidelines,
        "updated_at": row["updated_at"] if row else None
    }


@app.put("/brand-guidelines")
def save_brand_guidelines(request: BrandGuidelinesRequest):

    guidelines = request.model_dump()

    updated_at = datetime.now(timezone.utc).isoformat()

    with get_db_connection() as connection:

        connection.execute("""
            INSERT INTO brand_guidelines (
                id,
                brand_name,
                brand_description,
                tone_of_voice,
                target_audience,
                preferred_words,
                prohibited_words,
                writing_rules,
                visual_guidelines,
                additional_rules,
                updated_at
            )

            VALUES (
                1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            )

            ON CONFLICT(id) DO UPDATE SET

                brand_name = excluded.brand_name,
                brand_description = excluded.brand_description,
                tone_of_voice = excluded.tone_of_voice,
                target_audience = excluded.target_audience,
                preferred_words = excluded.preferred_words,
                prohibited_words = excluded.prohibited_words,
                writing_rules = excluded.writing_rules,
                visual_guidelines = excluded.visual_guidelines,
                additional_rules = excluded.additional_rules,
                updated_at = excluded.updated_at

        """, (

            guidelines["brand_name"],
            guidelines["brand_description"],
            guidelines["tone_of_voice"],
            guidelines["target_audience"],
            guidelines["preferred_words"],
            guidelines["prohibited_words"],
            guidelines["writing_rules"],
            guidelines["visual_guidelines"],
            guidelines["additional_rules"],
            updated_at

        ))

    return {
        "status": "success",
        "message": "Brand guidelines saved successfully.",
        "guidelines": guidelines,
        "updated_at": updated_at
    }


# ==========================================
# 9. ADVERTISEMENT COMPLIANCE PIPELINE
# ==========================================

def evaluate_and_save_compliance(
    content: str,
    analysis_mode: str = "text",
    image_filename: str = "",
    image_path: str = "",
    ocr_extracted_text: str = "",
    processing_engine: str = "Groq AI (openai/gpt-oss-120b)"
) -> dict:
    """
    Core reusable compliance pipeline:
    1. Evaluates copy against active SQLite brand guidelines
    2. Runs deterministic rule-based compliance pattern detection
    3. Runs deep LLM brand governance & rewriting via Groq AI
    4. Merges and deduplicates issues
    5. Calculates weighted risk score and severity
    6. Persists analysis to SQLite analyses table
    """
    text = content.lower()

    # 1. FETCH SAVED BRAND GUIDELINES
    guidelines = get_saved_brand_guidelines()

    rule_issues = []

    def add_issue(
        pattern,
        issue_type,
        explanation,
        severity,
        recommendation
    ):
        match = re.search(
            pattern,
            text,
            re.IGNORECASE
        )

        if match:
            rule_issues.append({
                "type": issue_type,
                "claim": match.group(0),
                "explanation": explanation,
                "severity": severity,
                "recommendation": recommendation
            })

    # 2. CHECK PROHIBITED WORDS FROM BRAND GUIDELINES
    prohibited_raw = (guidelines.get("prohibited_words") or "").strip()

    if prohibited_raw:
        prohibited_terms = [
            t.strip()
            for t in re.split(r"[,;\n]+", prohibited_raw)
            if t.strip()
        ]

        for term in prohibited_terms:
            pattern = r"\b" + re.escape(term) + r"\b"
            match = re.search(pattern, text, re.IGNORECASE)

            if match:
                rule_issues.append({
                    "type": "Prohibited Brand Term",
                    "claim": match.group(0),
                    "explanation": f"The advertisement uses '{match.group(0)}', which is explicitly prohibited by your brand guidelines.",
                    "severity": "High",
                    "recommendation": "Remove or replace this prohibited term with approved brand vocabulary."
                })

    # 3. RULE-BASED COMPLIANCE CHECKS
    # Unrealistic Guarantees
    add_issue(
        r"100\s*%|guarantee(?:d|s)?|risk[- ]free|zero risk|never fail",
        "Unrealistic Guarantee",
        "The advertisement makes an absolute promise that may require substantial supporting evidence.",
        "High",
        "Avoid promising guaranteed results unless they can be substantiated."
    )

    # Superiority Claims
    add_issue(
        r"#\s*1\b|number\s+one|no\.?\s*1\b|best in the world|world['’]s best|leading product",
        "Unsubstantiated Superiority Claim",
        "The advertisement claims superiority without providing comparative evidence.",
        "Medium",
        "Provide reliable comparative evidence or use more balanced wording."
    )

    # Performance Claims
    add_issue(
        r"\b\d+(?:\.\d+)?\s*x\s+(?:more|better|faster|higher|greater|productive)\b|\b\d+\s*%\s*(?:more|better|faster|higher|improvement|increase)",
        "Unsubstantiated Performance Claim",
        "The advertisement uses numerical performance claims that may require measurable supporting evidence.",
        "Medium",
        "Provide credible test results and evidence supporting the stated performance improvement."
    )

    # Social Proof
    add_issue(
        r"\b(?:thousands|millions|billions|hundreds)\s+of\s+(?:happy\s+)?customers\b|\b\d[\d,]*\s+(?:happy\s+)?customers\b",
        "Unverified Social Proof",
        "The advertisement uses customer numbers or popularity claims without providing supporting evidence.",
        "Medium",
        "Provide verifiable customer data or use appropriately qualified statements."
    )

    # Artificial Urgency
    add_issue(
        r"limited time|act now|last chance|once.in.a.lifetime|only for the next \d+\s*(?:hours?|days?)|offer expires|hurry up",
        "Artificial Urgency",
        "The advertisement creates urgency or scarcity that should be supported by genuine offer conditions.",
        "Medium",
        "Ensure promotional deadlines are genuine and clearly communicate the applicable terms."
    )

    # Discount Claims
    add_issue(
        r"\b\d{1,3}\s*%\s*off\b",
        "Unverified Discount Claim",
        "The advertised discount may require evidence of the original price and applicable offer conditions.",
        "Medium",
        "Verify the reference price, discount calculation and offer terms."
    )

    # 4. GROQ AI DEEP BRAND & COMPLIANCE EVALUATION
    ai_issues, suggested_revision, revision_source = (
        analyze_with_groq_and_rewrite(
            content,
            guidelines,
            rule_issues
        )
    )

    # 5. MERGE RULE-BASED AND AI ISSUES
    issues = merge_compliance_issues(rule_issues, ai_issues)

    # 6. RISK SCORE CALCULATION
    severity_weights = {
        "High": 30,
        "Medium": 20,
        "Low": 10
    }

    risk_score = min(
        sum(
            severity_weights.get(issue["severity"], 20)
            for issue in issues
        ),
        100
    )

    if risk_score >= 60:
        risk_level = "High"
    elif risk_score >= 25:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    # 7. SAVE ANALYSIS TO DATABASE
    created_at = datetime.now(timezone.utc).isoformat()
    approval_status = "Pending" if issues else "Not Required"

    with get_db_connection() as connection:
        cursor = connection.execute("""
            INSERT INTO analyses (
                original_content,
                risk_score,
                risk_level,
                total_issues,
                issues_json,
                suggested_revision,
                approval_status,
                created_at,
                analysis_mode,
                image_filename,
                image_path,
                ocr_extracted_text,
                processing_engine
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            content,
            risk_score,
            risk_level,
            len(issues),
            json.dumps(issues),
            suggested_revision,
            approval_status,
            created_at,
            analysis_mode,
            image_filename,
            image_path,
            ocr_extracted_text,
            processing_engine
        ))

        analysis_id = cursor.lastrowid

    image_url = f"/images/{image_path}" if image_path else ""

    return {
        "message": "Advertisement analysis completed!",
        "status": "success",
        "analysis_id": analysis_id,
        "analysis_mode": analysis_mode,
        "image_filename": image_filename,
        "image_path": image_path,
        "image_url": image_url,
        "ocr_extracted_text": ocr_extracted_text,
        "processing_engine": processing_engine,
        "original_content": content,
        "risk_score": risk_score,
        "risk_level": risk_level,
        "total_issues": len(issues),
        "issues": issues,
        "suggested_revision": suggested_revision,
        "revision_source": revision_source,
        "approval_status": approval_status,
        "created_at": created_at
    }


# ==========================================
# 10. TEXT ADVERTISEMENT ANALYSIS ROUTE
# ==========================================

@app.post("/analyze")
def analyze_content(request: AnalysisRequest):
    content = request.content.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Please provide advertisement content."
        )

    return evaluate_and_save_compliance(
        content=content,
        analysis_mode="text",
        processing_engine="Groq AI (openai/gpt-oss-120b)"
    )


# ==========================================
# 11. IMAGE & POSTER ADVERTISEMENT ANALYSIS ROUTE
# ==========================================

ALLOWED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Secure endpoint for poster & banner advertisement image analysis:
    1. Validates file presence, extensions, MIME types, and size limits (<= 10MB)
    2. Validates image integrity using Pillow (detects corrupted uploads)
    3. Persists uploaded image securely to disk with a collision-resistant unique filename
    4. Uses RapidOCR to extract visible advertisement text
    5. Evaluates extracted text using the existing brand guidelines and compliance pipeline
    6. Discloses processing engine and text-only LLM status transparently
    """
    if not file or not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected. Please select a valid PNG, JPG, or WEBP image."
        )

    original_filename = Path(file.filename).name
    ext = Path(original_filename).suffix.lower()

    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: PNG, JPG, JPEG, WEBP."
        )

    if file.content_type and file.content_type.lower() not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid MIME type '{file.content_type}'. Please upload an image/png, image/jpeg, or image/webp."
        )

    image_bytes = await file.read()
    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="The uploaded image file is empty.")

    if len(image_bytes) > MAX_IMAGE_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File size exceeds the 10 MB limit.")

    # Validate image file integrity with Pillow
    try:
        from PIL import Image
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            pil_img.verify()
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is corrupted or not a valid image format."
        )

    # Generate collision-resistant unique filename and persist image bytes securely
    clean_stem = re.sub(r"[^a-zA-Z0-9_\-]", "_", Path(original_filename).stem)[:32] or "poster"
    stored_filename = f"ad_{uuid.uuid4().hex[:12]}_{clean_stem}{ext}"
    uploads_dir = get_uploads_dir()
    destination_path = uploads_dir / stored_filename

    try:
        with open(destination_path, "wb") as f_out:
            f_out.write(image_bytes)
    except Exception as save_err:
        logger.error(f"Failed to persist uploaded advertisement image: {save_err}")
        raise HTTPException(status_code=500, detail="Failed to save uploaded image on the server.")

    # Extract visible advertisement text using RapidOCR
    extracted_text, ocr_lines, ocr_status = extract_text_from_image_bytes(image_bytes)

    engine_name = "RapidOCR Engine + Groq AI (openai/gpt-oss-120b)"
    ai_status_note = (
        "Configured Groq model 'openai/gpt-oss-120b' is a text-based LLM without direct vision capability. "
        "Visible poster text was extracted verbatim via RapidOCR and analyzed against active brand guidelines and truth-in-advertising standards."
    )

    if not extracted_text.strip():
        return {
            "status": "warning",
            "message": "No visible advertisement text was detected in the uploaded image poster.",
            "analysis_mode": "image",
            "image_filename": original_filename,
            "image_path": stored_filename,
            "image_url": f"/images/{stored_filename}",
            "ocr_status": ocr_status,
            "extracted_text": "",
            "ocr_lines": [],
            "risk_score": 0,
            "risk_level": "Low",
            "total_issues": 0,
            "issues": [],
            "suggested_revision": "No advertisement copy was detected on this poster to evaluate or revise.",
            "revision_source": "RapidOCR",
            "processing_engine": "RapidOCR Engine",
            "ai_multimodal_status": ai_status_note,
            "approval_status": "Not Required"
        }

    # Run the compliance evaluation pipeline with the extracted text and stored image reference
    result = evaluate_and_save_compliance(
        content=extracted_text,
        analysis_mode="image",
        image_filename=original_filename,
        image_path=stored_filename,
        ocr_extracted_text=extracted_text,
        processing_engine=engine_name
    )

    result["ocr_status"] = ocr_status
    result["extracted_text"] = extracted_text
    result["ocr_lines"] = ocr_lines
    result["ai_multimodal_status"] = ai_status_note

    return result


# ==========================================
# 12. IMAGE SERVING & PREVIEW ROUTES
# ==========================================

@app.get("/images/{filename}")
def serve_image(filename: str):
    """
    Secure image-serving endpoint:
    - Protects against directory traversal ('..', '/', '\')
    - Enforces allowed extensions (.png, .jpg, .jpeg, .webp)
    - Verifies file is strictly contained within uploads directory
    - Returns proper Content-Type / Media-Type
    """
    clean_name = Path(filename).name
    if not clean_name or clean_name != filename or ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename requested.")

    ext = Path(clean_name).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file format '{ext}'.")

    uploads_dir = get_uploads_dir().resolve()
    target_file = (uploads_dir / clean_name).resolve()

    # Enforce directory containment
    try:
        target_file.relative_to(uploads_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied.")

    if not target_file.is_file():
        raise HTTPException(status_code=404, detail="Requested image not found.")

    media_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }
    return FileResponse(
        path=str(target_file),
        media_type=media_types.get(ext, "image/png"),
        headers={"Cache-Control": "public, max-age=86400"}
    )


@app.get("/analyses/{analysis_id}/image")
def get_analysis_image(analysis_id: int):
    """
    Retrieves the original uploaded advertisement image directly by analysis ID.
    """
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT image_path, image_filename FROM analyses WHERE id = ?",
            (analysis_id,)
        ).fetchone()

        if not row or not row["image_path"]:
            raise HTTPException(status_code=404, detail=f"No image attached to analysis #{analysis_id}.")

        image_path = row["image_path"]

    return serve_image(image_path)


# ==========================================
# 13. HISTORY API
# ==========================================

@app.get("/history")
def get_history():

    with get_db_connection() as connection:

        rows = connection.execute("""

            SELECT *
            FROM analyses
            ORDER BY id DESC

        """).fetchall()

    history = []

    for row in rows:

        item = dict(row)

        item["issues"] = json.loads(
            item.pop("issues_json") or "[]"
        )
        if item.get("image_path"):
            item["image_url"] = f"/images/{item['image_path']}"
        else:
            item["image_url"] = ""

        history.append(item)

    return {

        "status": "success",

        "total": len(history),

        "history": history

    }


# ==========================================
# 14. APPROVALS API
# ==========================================

@app.get("/approvals")
def get_approvals():

    with get_db_connection() as connection:

        rows = connection.execute("""

            SELECT *
            FROM analyses
            WHERE approval_status = 'Pending'
            ORDER BY id DESC

        """).fetchall()

    approvals = []

    for row in rows:

        item = dict(row)

        item["issues"] = json.loads(
            item.pop("issues_json") or "[]"
        )
        if item.get("image_path"):
            item["image_url"] = f"/images/{item['image_path']}"
        else:
            item["image_url"] = ""

        approvals.append(item)

    return {

        "status": "success",

        "total": len(approvals),

        "approvals": approvals

    }


# ==========================================
# 15. UPDATE APPROVAL STATUS
# ==========================================

@app.patch("/approvals/{analysis_id}")
def update_approval(

    analysis_id: int,

    request: ApprovalRequest

):

    with get_db_connection() as connection:

        cursor = connection.execute("""

            UPDATE analyses

            SET approval_status = ?

            WHERE id = ?

            AND approval_status = 'Pending'

        """, (

            request.status,

            analysis_id

        ))

        if cursor.rowcount == 0:

            raise HTTPException(

                status_code=404,

                detail="Pending analysis not found."

            )

    return {

        "status": "success",

        "message": f"Analysis {request.status.lower()} successfully.",

        "analysis_id": analysis_id,

        "approval_status": request.status

    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("main:app", host=host, port=port, reload=False)

