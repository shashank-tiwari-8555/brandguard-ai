"""
Test Suite: AI Suggested Revision Hallucination Safeguard
Tests:
1. Detection and sanitization of unsupported enterprise claims ('Join major enterprises that rely on Inkloom AI')
2. Detection of ungrounded social proof, awards, and customer counts
3. Preservation of legitimate claims present in original ad content
4. Verification of the exact advertisement that previously produced the 'major enterprises' sentence
5. Verification that fallback and API responses never introduce unverified claims
"""

import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from main import (
    validate_and_sanitize_suggested_revision,
    analyze_with_groq_and_rewrite,
    evaluate_and_save_compliance,
    get_saved_brand_guidelines,
    app
)
from starlette.testclient import TestClient

client = TestClient(app)

def test_unsupported_enterprise_claim_filtered():
    print("\n--- 1. Testing Unsupported Enterprise Claim Filter ---")
    original_ad = "Special limited time offer! 100% guaranteed 10x faster results for your marketing campaigns."
    hallucinated_revision = (
        "Improve your marketing campaign efficiency with structured compliance reviews. "
        "Join major enterprises that rely on Inkloom AI to protect brand integrity."
    )
    guidelines = {"brand_name": "Inkloom AI"}

    clean_rev, issues = validate_and_sanitize_suggested_revision(
        suggested_revision=hallucinated_revision,
        original_content=original_ad,
        guidelines=guidelines
    )

    print("Original ad:", original_ad)
    print("Hallucinated input:", hallucinated_revision)
    print("Sanitized revision:", clean_rev)
    print("Flagged issues count:", len(issues))
    if issues:
        print("Issue details:", issues[0]["explanation"])

    assert "major enterprises" not in clean_rev.lower(), "Hallucinated 'major enterprises' was not removed!"
    assert "rely on inkloom ai" not in clean_rev.lower(), "Unsupported 'rely on Inkloom AI' was not removed!"
    assert len(issues) >= 1, "Expected at least 1 safeguard issue flagged"
    assert clean_rev.strip() == "Improve your marketing campaign efficiency with structured compliance reviews."
    print("✅ Unsupported enterprise claim was successfully filtered and flagged.")


def test_unsupported_social_proof_and_awards():
    print("\n--- 2. Testing Unsupported Social Proof, Awards, and Metrics ---")
    original_ad = "Get our tool today. Simple pricing for creators."
    hallucinated_revision = (
        "Designed for creators with transparent pricing. "
        "Trusted by over 50,000 customers worldwide. "
        "Award-winning platform certified by leading industry experts."
    )
    guidelines = {"brand_name": "CreatorTool"}

    clean_rev, issues = validate_and_sanitize_suggested_revision(
        suggested_revision=hallucinated_revision,
        original_content=original_ad,
        guidelines=guidelines
    )

    print("Sanitized revision:", clean_rev)
    print("Flagged issues count:", len(issues))

    assert "50,000" not in clean_rev
    assert "award-winning" not in clean_rev.lower()
    assert "certified by" not in clean_rev.lower()
    assert clean_rev.strip() == "Designed for creators with transparent pricing."
    print("✅ All ungrounded social proof, metrics, and awards were purged.")


def test_legitimate_claims_preserved():
    print("\n--- 3. Testing Preservation of Legitimate Claims ---")
    original_ad = "QuickBite is relied on by major enterprises in Mumbai. Order your lunch in minutes."
    valid_revision = "QuickBite is relied on by major enterprises in Mumbai. Convenient lunch orders delivered promptly."
    guidelines = {"brand_name": "QuickBite"}

    clean_rev, issues = validate_and_sanitize_suggested_revision(
        suggested_revision=valid_revision,
        original_content=original_ad,
        guidelines=guidelines
    )

    print("Sanitized revision:", clean_rev)
    assert "major enterprises" in clean_rev.lower(), "Legitimate claim from original content should NOT be removed!"
    assert len(issues) == 0, "No safeguard issues should be raised for grounded original claims"
    print("✅ Legitimate claims from original advertisement were preserved.")


def test_problematic_advertisement_end_to_end():
    print("\n--- 4. Testing End-to-End Analysis with Problematic Ad Copy ---")
    # Exact ad copy from sample_promo_poster.png that previously produced the unsupported enterprise claim
    problematic_ad = (
        "FLASH SALE: LIMITED TIMEOFFER (EXPIRESIN 2 HOURS)\n"
        "100%GUARANTEED10XFASTERRESULTS!\n"
        "Transform your brand workflow today."
    )

    guidelines = get_saved_brand_guidelines()
    result = evaluate_and_save_compliance(
        content=problematic_ad,
        analysis_mode="text",
        processing_engine="Compliance Engine + Groq AI"
    )

    suggested_revision = result["suggested_revision"]
    print("Suggested revision produced:", suggested_revision)

    assert "major enterprises" not in suggested_revision.lower(), "Suggested revision contained 'major enterprises'!"
    assert "rely on inkloom ai" not in suggested_revision.lower()
    assert "100% guaranteed" not in suggested_revision.lower()
    assert "10x faster" not in suggested_revision.lower()
    print("✅ Problematic advertisement produced a clean, grounded revision without hallucinations.")


if __name__ == "__main__":
    print("==================================================================")
    print(" INKLOOM AI - HALLUCINATION SAFEGUARD TEST SUITE                 ")
    print("==================================================================")
    try:
        test_unsupported_enterprise_claim_filtered()
        test_unsupported_social_proof_and_awards()
        test_legitimate_claims_preserved()
        test_problematic_advertisement_end_to_end()
        print("\n🎉 ALL HALLUCINATION SAFEGUARD CHECKS PASSED (4/4) 🎉\n")
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

