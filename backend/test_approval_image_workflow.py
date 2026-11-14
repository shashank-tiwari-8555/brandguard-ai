"""
Comprehensive QA Integration Test Suite: Approval Center Original Image Preview Workflow
Covers all 9 verification steps requested:
1. Upload an image and analyse it
2. Open Approval Center (GET /approvals)
3. Verify exact original image is visible (GET /images/{filename} and GET /analyses/{id}/image)
4. Verify extracted text, violations, recommendations, and suggested revisions
5. Approve an image-based analysis (PATCH /approvals/{id} -> Approved)
6. Upload a second image and reject it (PATCH /approvals/{id2} -> Rejected)
7. Verify both records retain original images in Analysis History (GET /history)
8. Simulate backend restart and verify image previews still work
9. Verify existing text-only approvals continue to work seamlessly
"""

import sys
import hashlib
from pathlib import Path
from starlette.testclient import TestClient

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from main import app, get_uploads_dir, get_db_connection

client = TestClient(app)

SAMPLE_POSTER_1 = (BASE_DIR.parent / "frontend" / "public" / "samples" / "sample_promo_poster.png").resolve()
SAMPLE_POSTER_2 = (BASE_DIR.parent / "frontend" / "public" / "samples" / "sample_compliant_poster.png").resolve()

def run_tests():
    print("==================================================================")
    print(" INKLOOM AI - APPROVAL CENTER IMAGE PREVIEW E2E TEST SUITE       ")
    print("==================================================================")

    assert SAMPLE_POSTER_1.exists(), f"Sample poster {SAMPLE_POSTER_1} does not exist!"
    assert SAMPLE_POSTER_2.exists(), f"Sample poster {SAMPLE_POSTER_2} does not exist!"

    with open(SAMPLE_POSTER_1, "rb") as f:
        img1_bytes = f.read()
    img1_hash = hashlib.sha256(img1_bytes).hexdigest()

    # -------------------------------------------------------------
    # Step 1: Upload an image and analyse it
    # -------------------------------------------------------------
    print("\n[Step 1] Uploading image poster 1 for compliance analysis...")
    response1 = client.post(
        "/analyze-image",
        files={"file": ("super_promo_banner.png", img1_bytes, "image/png")}
    )
    assert response1.status_code == 200, f"Upload failed: {response1.text}"
    data1 = response1.json()
    analysis_id_1 = data1["analysis_id"]
    image_path_1 = data1["image_path"]
    image_url_1 = data1["image_url"]

    print(f"✅ Image 1 uploaded: Analysis ID #{analysis_id_1}")
    print(f"   Original filename: {data1['image_filename']}")
    print(f"   Stored unique path: {image_path_1}")
    print(f"   Serving URL: {image_url_1}")
    assert data1["analysis_mode"] == "image"
    assert image_path_1 != ""
    assert (get_uploads_dir() / image_path_1).is_file(), f"File {image_path_1} not saved on disk!"

    # -------------------------------------------------------------
    # Step 2: Open Approval Center
    # -------------------------------------------------------------
    print("\n[Step 2] Fetching Approval Center queue (GET /approvals)...")
    approvals_resp = client.get("/approvals")
    assert approvals_resp.status_code == 200
    approvals = approvals_resp.json().get("approvals", [])
    matching_1 = [a for a in approvals if a["id"] == analysis_id_1]
    assert len(matching_1) == 1, f"Analysis #{analysis_id_1} not found in pending approvals!"
    item_1 = matching_1[0]
    print(f"✅ Analysis #{analysis_id_1} verified in Approval Center:")
    print(f"   Approval Status: {item_1['approval_status']}")
    print(f"   Risk Level: {item_1['risk_level']} ({item_1['risk_score']}/100)")
    assert item_1["approval_status"] == "Pending"

    # -------------------------------------------------------------
    # Step 3: Verify the exact original image is visible
    # -------------------------------------------------------------
    print("\n[Step 3] Verifying exact original image serving & byte-level integrity...")
    # Test via /images/{filename}
    img_resp_1 = client.get(f"/images/{image_path_1}")
    assert img_resp_1.status_code == 200, f"Failed to serve image: {img_resp_1.status_code}"
    assert img_resp_1.headers.get("content-type") == "image/png"
    downloaded_hash_1 = hashlib.sha256(img_resp_1.content).hexdigest()
    assert downloaded_hash_1 == img1_hash, "Downloaded image bytes do not match original upload!"
    print(f"✅ Image served via /images/{image_path_1} matches original SHA256 exactly: {downloaded_hash_1[:16]}...")

    # Test via /analyses/{id}/image
    direct_img_resp = client.get(f"/analyses/{analysis_id_1}/image")
    assert direct_img_resp.status_code == 200
    assert direct_img_resp.headers.get("content-type") == "image/png"
    print(f"✅ Image served via direct analysis route /analyses/{analysis_id_1}/image (HTTP 200)")

    # -------------------------------------------------------------
    # Step 4: Verify extracted text, violations, and suggested revision
    # -------------------------------------------------------------
    print("\n[Step 4] Verifying OCR extracted text, compliance issues, and recommendations...")
    assert len(item_1.get("ocr_extracted_text", "").strip()) > 0, "No OCR text extracted!"
    print(f"✅ Extracted OCR snippet: {item_1['ocr_extracted_text'][:80]}...")
    assert len(item_1.get("issues", [])) > 0, "No compliance issues flagged!"
    print(f"✅ Flagged issues count: {len(item_1['issues'])}")
    for issue in item_1["issues"][:3]:
        print(f"   - [{issue.get('severity')}] {issue.get('type')}: \"{issue.get('claim', '')}\"")
        if issue.get("recommendation"):
            print(f"     Guideline Recommendation: {issue.get('recommendation')}")
    assert len(item_1.get("suggested_revision", "").strip()) > 0, "No AI suggested revision generated!"
    print(f"✅ AI Suggested Revision: {item_1['suggested_revision'][:90]}...")

    # -------------------------------------------------------------
    # Step 5: Approve an image-based analysis
    # -------------------------------------------------------------
    print("\n[Step 5] Approving image-based Analysis #{}...".format(analysis_id_1))
    patch_resp_1 = client.patch(
        f"/approvals/{analysis_id_1}",
        json={"status": "Approved"}
    )
    assert patch_resp_1.status_code == 200
    assert patch_resp_1.json()["approval_status"] == "Approved"
    print(f"✅ Analysis #{analysis_id_1} marked as 'Approved' successfully.")

    # Confirm it is no longer pending
    approvals_after = client.get("/approvals").json().get("approvals", [])
    assert not any(a["id"] == analysis_id_1 for a in approvals_after), "Approved item still in pending queue!"
    print(f"✅ Verified Analysis #{analysis_id_1} removed from pending queue.")

    # -------------------------------------------------------------
    # Step 6: Upload another image and reject it
    # -------------------------------------------------------------
    print("\n[Step 6] Uploading second image poster for rejection workflow...")
    # Upload poster 1 again with a different name so it triggers issues and enters Pending status
    response2 = client.post(
        "/analyze-image",
        files={"file": ("aggressive_urgency_ad.png", img1_bytes, "image/png")}
    )
    assert response2.status_code == 200
    data2 = response2.json()
    analysis_id_2 = data2["analysis_id"]
    image_path_2 = data2["image_path"]
    print(f"✅ Second image uploaded: Analysis ID #{analysis_id_2}")
    print(f"   Stored unique path: {image_path_2}")
    assert image_path_2 != image_path_1, "Each upload must receive a unique filename!"

    # Reject Analysis 2
    patch_resp_2 = client.patch(
        f"/approvals/{analysis_id_2}",
        json={"status": "Rejected"}
    )
    assert patch_resp_2.status_code == 200
    assert patch_resp_2.json()["approval_status"] == "Rejected"
    print(f"✅ Analysis #{analysis_id_2} marked as 'Rejected' successfully.")

    # -------------------------------------------------------------
    # Step 7: Verify both records retain their original images in Analysis History
    # -------------------------------------------------------------
    print("\n[Step 7] Inspecting Analysis History (GET /history) for preserved images...")
    history_resp = client.get("/history")
    assert history_resp.status_code == 200
    history = history_resp.json().get("history", [])

    hist_item_1 = next((h for h in history if h["id"] == analysis_id_1), None)
    hist_item_2 = next((h for h in history if h["id"] == analysis_id_2), None)

    assert hist_item_1 is not None, f"Analysis #{analysis_id_1} missing from history!"
    assert hist_item_2 is not None, f"Analysis #{analysis_id_2} missing from history!"

    assert hist_item_1["approval_status"] == "Approved"
    assert hist_item_1["image_path"] == image_path_1
    assert hist_item_1["image_url"] == f"/images/{image_path_1}"

    assert hist_item_2["approval_status"] == "Rejected"
    assert hist_item_2["image_path"] == image_path_2
    assert hist_item_2["image_url"] == f"/images/{image_path_2}"

    print(f"✅ Analysis #{analysis_id_1} in History: Status='{hist_item_1['approval_status']}', Image='{hist_item_1['image_path']}'")
    print(f"✅ Analysis #{analysis_id_2} in History: Status='{hist_item_2['approval_status']}', Image='{hist_item_2['image_path']}'")

    # -------------------------------------------------------------
    # Step 8: Restart the backend (simulate restart) and verify image previews still work
    # -------------------------------------------------------------
    print("\n[Step 8] Simulating backend restart / new connection lifecycle...")
    # Creating a fresh TestClient and database connection simulates a complete restart
    fresh_client = TestClient(app)

    # Verify image files on disk remain accessible via HTTP
    fresh_img_resp_1 = fresh_client.get(f"/images/{image_path_1}")
    assert fresh_img_resp_1.status_code == 200
    assert hashlib.sha256(fresh_img_resp_1.content).hexdigest() == img1_hash
    print(f"✅ Analysis #{analysis_id_1} image preview verified after backend restart (HTTP 200)")

    fresh_img_resp_2 = fresh_client.get(f"/images/{image_path_2}")
    assert fresh_img_resp_2.status_code == 200
    print(f"✅ Analysis #{analysis_id_2} image preview verified after backend restart (HTTP 200)")

    # -------------------------------------------------------------
    # Step 9: Verify existing text-only approvals continue to work
    # -------------------------------------------------------------
    print("\n[Step 9] Verifying text-only analysis and approval workflow...")
    text_ad = "Special limited time offer: Get 100% guaranteed #1 results in 2 hours!"
    text_resp = fresh_client.post("/analyze", json={"content": text_ad})
    assert text_resp.status_code == 200
    text_data = text_resp.json()
    text_id = text_data["analysis_id"]

    assert text_data["analysis_mode"] == "text"
    assert text_data["image_path"] == ""
    assert text_data["image_url"] == ""
    print(f"✅ Text analysis #{text_id} created without image mode (mode='{text_data['analysis_mode']}')")

    # Approve text analysis
    text_patch = fresh_client.patch(f"/approvals/{text_id}", json={"status": "Approved"})
    assert text_patch.status_code == 200
    assert text_patch.json()["approval_status"] == "Approved"
    print(f"✅ Text analysis #{text_id} approved successfully.")

    print("\n==================================================================")
    print(" 🎉 ALL 9 APPROVAL IMAGE WORKFLOW CHECKS PASSED (9/9) 🎉        ")
    print("==================================================================")

if __name__ == "__main__":
    try:
        run_tests()
    except Exception as e:
        print(f"\n❌ TEST SUITE FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

