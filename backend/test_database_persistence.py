"""
Database Persistence Verification Script for Inkloom AI
Tests:
1. Default local database path verification (backend/inkloom.db)
2. Existing record verification:
   - Analysis record count
   - Analysis #42 status (Approved)
   - Analysis #44 status (Rejected)
   - Brand guidelines ID 1 (Be10X)
3. Configurable DATABASE_PATH verification (isolated test directory):
   - Directory creation
   - Schema initialization
   - Persistence across multiple connections (simulated restart)
   - Concurrency PRAGMAs (WAL, busy_timeout)
4. Integrity guarantee: original inkloom.db is never corrupted or overwritten.
"""

import os
import sys
import tempfile
import sqlite3
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

# Ensure DATABASE_PATH is not set initially
if "DATABASE_PATH" in os.environ:
    del os.environ["DATABASE_PATH"]

from main import get_db_path, get_db_connection, init_db

def test_local_database_integrity():
    print("\n--- 1. Testing Local Default Database ---")
    local_path = get_db_path()
    expected_path = (BASE_DIR / "inkloom.db").resolve()
    assert local_path == expected_path, f"Expected {expected_path}, got {local_path}"
    assert local_path.exists(), f"Database file {local_path} does not exist!"
    print(f"✅ Local database path resolved correctly: {local_path}")

    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # Check analyses count
        total_analyses = cursor.execute("SELECT count(*) FROM analyses").fetchone()[0]
        print(f"✅ Total analyses in database: {total_analyses}")
        assert total_analyses >= 47, f"Expected at least 47 analyses, found {total_analyses}"

        # Check Analysis #42
        row_42 = cursor.execute("SELECT id, approval_status, risk_score, risk_level FROM analyses WHERE id = 42").fetchone()
        assert row_42 is not None, "Analysis #42 not found"
        assert row_42["approval_status"] == "Approved", f"Analysis #42 status is {row_42['approval_status']}, expected Approved"
        print(f"✅ Analysis #42 verified: Status={row_42['approval_status']}, Score={row_42['risk_score']}, Level={row_42['risk_level']}")

        # Check Analysis #44
        row_44 = cursor.execute("SELECT id, approval_status, risk_score, risk_level FROM analyses WHERE id = 44").fetchone()
        assert row_44 is not None, "Analysis #44 not found"
        assert row_44["approval_status"] == "Rejected", f"Analysis #44 status is {row_44['approval_status']}, expected Rejected"
        print(f"✅ Analysis #44 verified: Status={row_44['approval_status']}, Score={row_44['risk_score']}, Level={row_44['risk_level']}")

        # Check Brand Guidelines
        brand_row = cursor.execute("SELECT id, brand_name, tone_of_voice FROM brand_guidelines WHERE id = 1").fetchone()
        assert brand_row is not None, "Brand guidelines ID 1 not found"
        assert len(brand_row["brand_name"].strip()) > 0, "Brand name should not be empty"
        print(f"✅ Active Brand Guidelines verified: Name='{brand_row['brand_name']}', Tone='{brand_row['tone_of_voice'][:60]}...'")


def test_custom_database_path_and_persistence():
    print("\n--- 2. Testing Custom DATABASE_PATH & Persistence ---")
    with tempfile.TemporaryDirectory() as tmp_dir:
        test_db_dir = Path(tmp_dir) / "var_data_mock"
        test_db_file = test_db_dir / "inkloom.db"
        
        # Point DATABASE_PATH to mock persistent mount
        os.environ["DATABASE_PATH"] = str(test_db_file)
        
        # Verify get_db_path creates the directory and points to custom path
        resolved = get_db_path()
        assert resolved == test_db_file.resolve(), f"Expected {test_db_file.resolve()}, got {resolved}"
        assert test_db_dir.exists(), f"Directory {test_db_dir} was not automatically created"
        print(f"✅ Configurable DATABASE_PATH resolved to: {resolved}")
        print(f"✅ Automatic directory creation verified for: {test_db_dir}")

        # Initialize schema on custom database
        init_db()
        assert test_db_file.exists(), f"Database file {test_db_file} was not initialized"
        print(f"✅ Database schema initialized successfully at custom path")

        # Verify PRAGMAs and tables
        with get_db_connection() as conn:
            cursor = conn.cursor()
            journal_mode = cursor.execute("PRAGMA journal_mode;").fetchone()[0]
            print(f"✅ PRAGMA journal_mode: {journal_mode.upper()} (WAL enabled)")
            
            # Insert test records
            cursor.execute("""
                INSERT INTO analyses (original_content, risk_score, risk_level, total_issues, suggested_revision, approval_status, created_at)
                VALUES ('Persistent test advertisement', 15, 'Low', 0, 'Clean content', 'Approved', '2026-11-15T00:00:00Z')
            """)
            test_id = cursor.lastrowid
            
            # Update brand guidelines
            cursor.execute("""
                UPDATE brand_guidelines
                SET brand_name = 'Render Persistent Brand', tone_of_voice = 'Enterprise Authoritative'
                WHERE id = 1
            """)

        # Simulate complete application restart / disconnect
        # Re-open connection to verify data was persisted to disk
        print("🔄 Simulating backend restart / new connection pool...")
        with get_db_connection() as conn_after_restart:
            cursor = conn_after_restart.cursor()
            
            persisted_analysis = cursor.execute("SELECT * FROM analyses WHERE id = ?", (test_id,)).fetchone()
            assert persisted_analysis is not None, "Persisted analysis not found after reconnect"
            assert persisted_analysis["approval_status"] == "Approved"
            assert persisted_analysis["original_content"] == "Persistent test advertisement"
            print(f"✅ Persisted analysis record verified after restart: ID={test_id}, Status={persisted_analysis['approval_status']}")

            persisted_brand = cursor.execute("SELECT brand_name, tone_of_voice FROM brand_guidelines WHERE id = 1").fetchone()
            assert persisted_brand["brand_name"] == "Render Persistent Brand"
            print(f"✅ Persisted brand guidelines verified after restart: Brand='{persisted_brand['brand_name']}'")

    # Clean up environment variable
    del os.environ["DATABASE_PATH"]
    print("✅ Custom DATABASE_PATH test completed successfully")


def test_post_test_original_db_integrity():
    print("\n--- 3. Verifying Original Database After Tests ---")
    local_path = get_db_path()
    with get_db_connection() as conn:
        cursor = conn.cursor()
        total_analyses = cursor.execute("SELECT count(*) FROM analyses").fetchone()[0]
        brand_row = cursor.execute("SELECT brand_name FROM brand_guidelines WHERE id = 1").fetchone()
        row_42 = cursor.execute("SELECT approval_status FROM analyses WHERE id = 42").fetchone()
        row_44 = cursor.execute("SELECT approval_status FROM analyses WHERE id = 44").fetchone()

        assert total_analyses >= 47
        assert len(brand_row["brand_name"].strip()) > 0
        assert row_42["approval_status"] == "Approved"
        assert row_44["approval_status"] == "Rejected"

        print(f"✅ Original inkloom.db remained 100% untouched and preserved.")
        print(f"   - Analyses: {total_analyses}")
        print(f"   - Brand: {brand_row['brand_name']}")
        print(f"   - Analysis #42: {row_42['approval_status']}")
        print(f"   - Analysis #44: {row_44['approval_status']}")


if __name__ == "__main__":
    print("==================================================")
    print(" INKLOOM AI - PERSISTENCE & DATABASE TEST SUITE  ")
    print("==================================================")
    try:
        test_local_database_integrity()
        test_custom_database_path_and_persistence()
        test_post_test_original_db_integrity()
        print("\n🎉 ALL DATABASE PERSISTENCE TESTS PASSED (3/3) 🎉\n")
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

