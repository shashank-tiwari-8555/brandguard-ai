"""
Inkloom AI – Comprehensive Automated QA Test Suite
Tests backend endpoints, Groq AI pipeline, rule-based fallback, E2E journey, and security.
"""

import sys
import os
import json
import sqlite3
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from main import app, get_db_connection, get_saved_brand_guidelines, analyze_with_groq_and_rewrite
from starlette.testclient import TestClient

client = TestClient(app)

results = {}

def run_test(name, func):
    try:
        print(f"\n[RUNNING] {name}...")
        func()
        print(f"[PASSED]  {name}")
        results[name] = "PASS"
    except Exception as e:
        print(f"[FAILED]  {name}: {e}")
        import traceback
        traceback.print_exc()
        results[name] = f"FAIL: {e}"

# ==========================================
# 1. BACKEND ENDPOINTS & ERROR HANDLING
# ==========================================

def test_health_endpoint():
    res = client.get("/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert data["status"] == "healthy"
    assert "groq_configured" in data
    print(f"  Health data: {data}")

def test_brand_guidelines_get():
    res = client.get("/brand-guidelines")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "guidelines" in data
    assert "brand_name" in data["guidelines"]
    print(f"  Brand Name: {data['guidelines']['brand_name']}")

def test_brand_guidelines_put():
    # Fetch current
    curr = client.get("/brand-guidelines").json()["guidelines"]
    try:
        # Update with test value
        updated = dict(curr)
        updated["brand_name"] = "Be10X"
        res = client.put("/brand-guidelines", json=updated)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["guidelines"]["brand_name"] == "Be10X"
        print("  PUT /brand-guidelines successfully saved and returned guidelines.")
    finally:
        client.put("/brand-guidelines", json=curr)

def test_analyze_empty_content_error():
    res = client.post("/analyze", json={"content": "   "})
    assert res.status_code in [400, 422], f"Expected 400 or 422, got {res.status_code}"
    print(f"  Empty content correctly rejected with HTTP {res.status_code}")

def test_history_get():
    res = client.get("/history")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "history" in data
    assert "total" in data
    print(f"  Total history records: {data['total']}")

def test_approvals_get():
    res = client.get("/approvals")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "approvals" in data
    print(f"  Pending approvals: {data['total']}")

def test_approvals_nonexistent_patch_error():
    res = client.patch("/approvals/99999999", json={"status": "Approved"})
    assert res.status_code == 404, f"Expected 404, got {res.status_code}"
    print(f"  Non-existent approval correctly returned HTTP {res.status_code}")

# ==========================================
# 2. GROQ AI INTEGRATION VS FALLBACK
# ==========================================

def test_groq_ai_live_analysis():
    test_ad = (
        "Try our groundbreaking software! 100% guaranteed to deliver 10x productivity gains "
        "for every single customer with zero risk!"
    )
    res = client.post("/analyze", json={"content": test_ad})
    assert res.status_code == 200
    data = res.json()
    assert data["total_issues"] > 0
    assert data["risk_score"] > 0
    assert data["revision_source"] in ["Groq AI", "Rule-based fallback"]
    print(f"  Analysis source: {data['revision_source']}")
    print(f"  Risk score: {data['risk_score']}/100 ({data['risk_level']})")
    print(f"  Total issues: {data['total_issues']}")
    print(f"  Revision: {data['suggested_revision'][:100]}...")

def test_rule_based_fallback_isolation():
    # Test analyze_with_groq_and_rewrite directly with empty client to verify fallback isolation
    import main as m
    original_client = m.client
    try:
        m.client = None
        guidelines = get_saved_brand_guidelines()
        issues, revision, source = analyze_with_groq_and_rewrite("Test content", guidelines, [])
        assert source == "Rule-based fallback"
        assert len(revision) > 0
        assert "GROQ_API_KEY" not in revision
        print("  Fallback cleanly generated safe revision without exposing secrets.")
    finally:
        m.client = original_client

# ==========================================
# 3. COMPLETE END-TO-END WORKFLOW
# ==========================================

def test_end_to_end_user_journey():
    # 1. Fetch original guidelines to restore at the end
    orig_res = client.get("/brand-guidelines")
    orig_guidelines = orig_res.json()["guidelines"]

    try:
        # 2. Configure guidelines with a unique prohibited word
        qa_guidelines = dict(orig_guidelines)
        qa_guidelines["brand_name"] = "Inkloom QA Brand"
        qa_guidelines["tone_of_voice"] = "Strictly factual, highly professional, scientific, concise."
        qa_guidelines["prohibited_words"] = "magic-cure, 100% guaranteed, miracle"
        qa_guidelines["preferred_words"] = "verifiable, enterprise compliance, benchmarked"

        put_res = client.put("/brand-guidelines", json=qa_guidelines)
        assert put_res.status_code == 200

        # Verify saved
        check_res = client.get("/brand-guidelines").json()["guidelines"]
        assert "magic-cure" in check_res["prohibited_words"]

        # 3. Submit ad with prohibited term and absolute claim
        test_ad = (
            "Our new platform is a magic-cure for all marketing teams! "
            "It comes with a 100% guaranteed result and #1 performance!"
        )

        # 4. Analyze
        analysis_res = client.post("/analyze", json={"content": test_ad})
        assert analysis_res.status_code == 200
        analysis_data = analysis_res.json()
        analysis_id = analysis_data["analysis_id"]

        # 5. Verify issues & risk score
        issue_types = [i["type"] for i in analysis_data["issues"]]
        print(f"  E2E Detected issue types: {issue_types}")
        assert any("Prohibited" in t or "magic-cure" in str(i) for t, i in zip(issue_types, analysis_data["issues"]))
        assert analysis_data["risk_score"] >= 50
        assert analysis_data["approval_status"] == "Pending"

        # 6. Verify revision excludes prohibited words
        assert "magic-cure" not in analysis_data["suggested_revision"].lower()

        # 7. Verify analysis appears in /history
        hist_res = client.get("/history")
        hist_ids = [item["id"] for item in hist_res.json()["history"]]
        assert analysis_id in hist_ids

        # 8. Verify analysis appears in /approvals
        appr_res = client.get("/approvals")
        appr_ids = [item["id"] for item in appr_res.json()["approvals"]]
        assert analysis_id in appr_ids

        # 9. Approve the analysis
        patch_res = client.patch(f"/approvals/{analysis_id}", json={"status": "Approved"})
        assert patch_res.status_code == 200
        assert patch_res.json()["approval_status"] == "Approved"

        # 10. Verify analysis is no longer in pending approvals
        appr_after = client.get("/approvals").json()["approvals"]
        appr_after_ids = [item["id"] for item in appr_after]
        assert analysis_id not in appr_after_ids

        # Verify status in history is now 'Approved'
        hist_item = next(i for i in client.get("/history").json()["history"] if i["id"] == analysis_id)
        assert hist_item["approval_status"] == "Approved"
        print("  E2E Approval transition confirmed (Pending -> Approved).")

    finally:
        # Restore original guidelines
        client.put("/brand-guidelines", json=orig_guidelines)
        restored = client.get("/brand-guidelines").json()["guidelines"]
        assert restored["brand_name"] == orig_guidelines["brand_name"]
        print("  Original Brand Guidelines safely restored.")

# ==========================================
# 4. DATA INTEGRITY & SECURITY CHECKS
# ==========================================

def test_database_persistence():
    db_path = Path(__file__).resolve().parent / "inkloom.db"
    assert db_path.exists()
    conn = sqlite3.connect(db_path)
    count = conn.execute("SELECT COUNT(*) FROM analyses").fetchone()[0]
    bg = conn.execute("SELECT brand_name FROM brand_guidelines WHERE id = 1").fetchone()
    conn.close()
    assert count > 0
    assert bg is not None
    print(f"  SQLite integrity verified: {count} analysis records, Brand: '{bg[0]}'")

def test_security_secrets_not_leaked():
    # 1. Check health response
    health_str = json.dumps(client.get("/health").json())
    assert "gsk_" not in health_str

    # 2. Check brand-guidelines response
    bg_str = json.dumps(client.get("/brand-guidelines").json())
    assert "gsk_" not in bg_str

    # 3. Check history response
    hist_str = json.dumps(client.get("/history").json())
    assert "gsk_" not in hist_str

    # 4. Check frontend built bundle
    dist_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist" / "assets"
    for js_file in dist_dir.glob("*.js"):
        content = js_file.read_text(encoding="utf-8")
        assert "gsk_" not in content, f"Secret detected in {js_file.name}!"
        assert "GROQ_API_KEY" not in content

    print("  Security verified: zero API keys or secrets in API responses or frontend build bundles.")

# ==========================================
# RUN ALL TESTS
# ==========================================

if __name__ == "__main__":
    tests = [
        ("Backend /health Endpoint", test_health_endpoint),
        ("Brand Guidelines GET", test_brand_guidelines_get),
        ("Brand Guidelines PUT", test_brand_guidelines_put),
        ("Analyze Error Handling (Empty Content)", test_analyze_empty_content_error),
        ("History GET Endpoint", test_history_get),
        ("Approvals GET Endpoint", test_approvals_get),
        ("Approvals Non-Existent ID 404", test_approvals_nonexistent_patch_error),
        ("Groq AI Live Analysis", test_groq_ai_live_analysis),
        ("Rule-Based Fallback Isolation", test_rule_based_fallback_isolation),
        ("End-to-End User Journey", test_end_to_end_user_journey),
        ("Database Persistence & Integrity", test_database_persistence),
        ("Security & API Key Protection", test_security_secrets_not_leaked),
    ]

    for name, func in tests:
        run_test(name, func)

    print("\n" + "=" * 50)
    print("QA TEST SUMMARY")
    print("=" * 50)
    all_passed = True
    for name, res in results.items():
        print(f"  {res:<6} : {name}")
        if res != "PASS":
            all_passed = False

    print("=" * 50)
    if all_passed:
        print("ALL QA TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("SOME QA TESTS FAILED!")
        sys.exit(1)

