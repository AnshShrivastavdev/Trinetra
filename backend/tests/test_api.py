import pytest
import mongomock
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from datetime import datetime, timezone
from bson import ObjectId

# Set up test environment variables before importing main application
import os
os.environ["ENVIRONMENT"] = "test"
os.environ["MOCK_AUTH_ENABLED"] = "True"
os.environ["MONGO_DB_NAME"] = "trinetra_test"

from app.main import app
from app.db import db

client = TestClient(app)

# Helper to mock MongoDB responses
class MockCursor:
    def __init__(self, items):
        self.items = items
        self.index = 0

    def limit(self, limit):
        self.items = self.items[:limit]
        return self

    def sort(self, sort_keys):
        # basic sort implementation for tests
        return self

    async def to_list(self, length):
        return self.items

@pytest.fixture(autouse=True)
def mock_db():
    """Fixture to clear and mock MongoDB collections for clean tests."""
    db.db = MagicMock()
    db.db.users = MagicMock()
    db.db.reports = MagicMock()
    db.db.votes = MagicMock()
    db.db.notifications = MagicMock()
    yield db

def test_health_check():
    """Verify health endpoint operates correctly."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["firebase_auth_mock"] is True

def test_health_alias_and_metrics():
    """Verify /health and /metrics observability endpoints."""
    # Test /health
    health_res = client.get("/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"
    assert "uptime_seconds" in health_res.json()

    # Test /metrics
    metrics_res = client.get("/metrics")
    assert metrics_res.status_code == 200
    mdata = metrics_res.json()
    assert mdata["status"] == "operational"
    assert "stats" in mdata
    assert "services" in mdata

def test_auth_sync_new_citizen():
    """Verify onboarding user sync records citizens as auto-approved."""
    mock_user_in_db = None
    db.db.users.find_one = AsyncMock(return_value=mock_user_in_db)
    db.db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="mock_id"))

    # Pass Citizen role
    headers = {"Authorization": "Bearer mock_token_citizen_user123_citizen@test.com"}
    payload = {"role": "citizen", "name": "Test Citizen"}
    
    response = client.post("/auth/sync", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Citizen"
    assert data["role"] == "citizen"
    assert data["is_approved"] is True

def test_auth_sync_new_authority_pending():
    """Verify onboarding user sync records authorities as pending approval."""
    mock_user_in_db = None
    db.db.users.find_one = AsyncMock(return_value=mock_user_in_db)
    db.db.users.insert_one = AsyncMock(return_value=MagicMock(inserted_id="mock_id"))

    # Pass Authority role
    headers = {"Authorization": "Bearer mock_token_authority_auth123_auth@test.com"}
    payload = {"role": "authority", "name": "Officer Friendly"}
    
    response = client.post("/auth/sync", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Officer Friendly"
    assert data["role"] == "authority"
    assert data["is_approved"] is False  # Requires admin approval

def test_create_report():
    """Verify standard crime report creation."""
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "user123", "role": "citizen", "is_approved": True, "name": "Jane Doe"
    })
    
    inserted_id = ObjectId()
    db.db.reports.insert_one = AsyncMock(return_value=MagicMock(inserted_id=inserted_id))

    headers = {"Authorization": "Bearer mock_token_citizen_user123"}
    payload = {
        "category": "Theft",
        "description": "Bike stolen from front porch.",
        "emergencyFlag": False,
        "anonymityFlag": True,
        "mediaUrls": ["http://cloudinary.com/img.jpg"],
        "location": {
            "lat": 12.97,
            "lng": 77.59,
            "address": "Park Street"
        }
    }

    # Patch reverse_geocode to prevent live HTTP call
    with patch("app.routes.reports.reverse_geocode", AsyncMock(return_value="Park Street")):
        response = client.post("/reports", json=payload, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["category"] == "Theft"
        assert data["createdBy"] == "anonymous"  # masked because anonymityFlag is True
        assert data["status"] == "Pending"
        assert data["voteCount"] == 0

def test_list_reports():
    """Verify fetching list of incidents."""
    db.db.users.find_one = AsyncMock(return_value={"role": "citizen", "firebase_uid": "user123"})
    
    mock_reports = [
        {
            "_id": ObjectId(),
            "category": "Assault",
            "description": "Scuffle at high school.",
            "emergencyFlag": True,
            "anonymityFlag": False,
            "mediaUrls": [],
            "location": {"lat": 12.0, "lng": 77.0, "address": "School Road"},
            "status": "Pending",
            "voteCount": 2,
            "createdBy": "Alice",
            "createdAt": datetime.now(timezone.utc),
            "updatedAt": datetime.now(timezone.utc)
        }
    ]
    db.db.reports.find = MagicMock(return_value=MockCursor(mock_reports))

    headers = {"Authorization": "Bearer mock_token_citizen_user123"}
    response = client.get("/reports", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["category"] == "Assault"
    assert data[0]["createdBy"] == "Alice"

def test_vote_self_block():
    """Verify citizen cannot vote on their own report."""
    report_id = ObjectId()
    # Mock report creator as user123
    db.db.reports.find_one = AsyncMock(return_value={
        "_id": report_id,
        "actualCreatedBy": "user123",
        "createdBy": "Jane Doe",
        "category": "Theft",
        "voteCount": 0
    })
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "user123", "role": "citizen", "is_approved": True
    })

    headers = {"Authorization": "Bearer mock_token_citizen_user123"}
    response = client.post(f"/reports/{str(report_id)}/vote", headers=headers)
    
    assert response.status_code == 400
    assert "Self-voting block" in response.json()["detail"]

def test_update_status_restricted():
    """Verify citizen role cannot modify incident status (Access Denied)."""
    report_id = ObjectId()
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "user123", "role": "citizen", "is_approved": True
    })

    headers = {"Authorization": "Bearer mock_token_citizen_user123"}
    response = client.patch(
        f"/reports/{str(report_id)}/status", 
        params={"status_update": "Ongoing"}, 
        headers=headers
    )
    assert response.status_code == 403

def test_update_status_authority():
    """Verify approved authorities can modify incident status."""
    report_id = ObjectId()
    report_mock = {
        "_id": report_id,
        "actualCreatedBy": "user123",
        "createdBy": "Jane Doe",
        "category": "Theft",
        "description": "Stolen bag",
        "emergencyFlag": False,
        "anonymityFlag": False,
        "mediaUrls": [],
        "location": {"lat": 12.97, "lng": 77.59, "address": "Park Street"},
        "status": "Pending",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }
    
    db.db.reports.find_one = AsyncMock(return_value=report_mock)
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "auth999", "role": "authority", "is_approved": True
    })
    db.db.notifications.insert_one = AsyncMock()
    
    updated_mock = report_mock.copy()
    updated_mock["status"] = "Ongoing"
    db.db.reports.find_one_and_update = AsyncMock(return_value=updated_mock)

    headers = {"Authorization": "Bearer mock_token_authority_auth999"}
    response = client.patch(
        f"/reports/{str(report_id)}/status", 
        params={"status_update": "Ongoing"}, 
        headers=headers
    )
    assert response.status_code == 200
    assert response.json()["status"] == "Ongoing"

def test_admin_stats():
    """Verify administrator statistics dashboard aggregation."""
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "admin001", "role": "admin", "is_approved": True
    })
    
    # Setup count mock triggers
    db.db.users.count_documents = AsyncMock(side_effect=lambda q: 5 if q.get("role") == "citizen" else 2)
    db.db.reports.count_documents = AsyncMock(side_effect=lambda q: 10 if not q else (1 if q.get("isFlagged") else 3))

    headers = {"Authorization": "Bearer mock_token_admin_admin001"}
    response = client.get("/admin/stats", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["users"]["citizens"] == 5
    assert data["reports"]["total"] == 10

class AsyncMockCursor:
    """Helper to mock an asynchronous MongoDB cursor iterator in python."""
    def __init__(self, items):
        self.items = items

    def __aiter__(self):
        self.index = 0
        return self

    async def __anext__(self):
        if self.index >= len(self.items):
            raise StopAsyncIteration
        item = self.items[self.index]
        self.index += 1
        return item

def test_admin_export_csv():
    """Verify administrator CSV exporting downloads and validation."""
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "admin001", "role": "admin", "is_approved": True
    })

    # 1. Mock Citizens
    mock_citizens = [
        {"firebase_uid": "c1", "name": "Citizen One", "email": "c1@test.com", "createdAt": "2026-07-07"},
        {"firebase_uid": "c2", "name": "Citizen Two", "email": "c2@test.com", "createdAt": "2026-07-07"}
    ]
    db.db.users.find = MagicMock(return_value=AsyncMockCursor(mock_citizens))

    headers = {"Authorization": "Bearer mock_token_admin_admin001"}
    response = client.get("/admin/export/csv", params={"type": "citizens"}, headers=headers)
    
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment; filename=citizens.csv" in response.headers["content-disposition"]
    
    csv_content = response.text
    assert "firebase_uid,name,email,createdAt" in csv_content
    assert "c1,Citizen One,c1@test.com,2026-07-07" in csv_content

    # 2. Mock Resolved Reports
    mock_reports = [
        {
            "_id": ObjectId("60c72b2f9b1d8a236c8b4568"),
            "category": "Theft",
            "description": "Lost property",
            "emergencyFlag": False,
            "anonymityFlag": False,
            "location": {"lat": 1.0, "lng": 2.0, "address": "First Ave"},
            "voteCount": 3,
            "isFlagged": False,
            "createdBy": "Alice",
            "createdAt": "2026-07-07",
            "updatedAt": "2026-07-07"
        }
    ]
    db.db.reports.find = MagicMock(return_value=AsyncMockCursor(mock_reports))
    response = client.get("/admin/export/csv", params={"type": "resolved_reports"}, headers=headers)
    
    assert response.status_code == 200
    assert "attachment; filename=resolved_reports.csv" in response.headers["content-disposition"]
    assert "Theft,Lost property,False,False" in response.text

def test_admin_manage_users():
    """Verify administrator account suspension, reactivation, and permanent deletion operations."""
    # Mock admin auth check
    db.db.users.find_one = AsyncMock(side_effect=lambda q: {
        "firebase_uid": "admin001", "role": "admin", "is_approved": True
    } if q.get("firebase_uid") == "admin001" else {
        "firebase_uid": "citizen777", "role": "citizen", "is_approved": True, "is_active": True
    })

    headers = {"Authorization": "Bearer mock_token_admin_admin001"}

    # 1. Test Toggle User Active (Citizen)
    db.db.users.update_one = AsyncMock()
    response = client.post("/admin/users/citizen777/toggle-active", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["is_active"] is False  # toggled from True to False

    # 2. Test Suspended User API Access Blocked
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "citizen777", "role": "citizen", "is_approved": True, "is_active": False
    })
    suspended_headers = {"Authorization": "Bearer mock_token_citizen_citizen777"}
    response = client.get("/reports", headers=suspended_headers)
    assert response.status_code == 403
    assert "suspended by the administrator" in response.json()["detail"]

    # 3. Test Delete User
    db.db.users.find_one = AsyncMock(side_effect=lambda q: {
        "firebase_uid": "admin001", "role": "admin", "is_approved": True
    } if q.get("firebase_uid") == "admin001" else {
        "firebase_uid": "citizen777", "role": "citizen"
    })
    db.db.users.delete_one = AsyncMock()
    db.db.votes.delete_many = AsyncMock()

    response = client.delete("/admin/users/citizen777", headers=headers)
    assert response.status_code == 200
    assert "permanently deleted" in response.json()["message"]


def test_upload_media_cloudinary():
    """Verify image file upload endpoint using mocked Cloudinary backend."""
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "user123", "role": "citizen", "is_approved": True, "name": "Jane Doe"
    })

    headers = {"Authorization": "Bearer mock_token_citizen_user123"}
    
    with patch("app.routes.reports.upload_image") as mock_upload:
        mock_upload.return_value = {
            "url": "https://res.cloudinary.com/x01g4ego/image/upload/v12345/trinetra/reports/sample.jpg",
            "public_id": "trinetra/reports/sample"
        }
        
        file_data = ("test.jpg", b"fake image bytes", "image/jpeg")
        response = client.post(
            "/reports/upload-image",
            files={"file": file_data},
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["url"] == "https://res.cloudinary.com/x01g4ego/image/upload/v12345/trinetra/reports/sample.jpg"
        assert data["type"] == "image"


def test_send_and_verify_otp():
    """Verify end-to-end phone/email 6-digit OTP authentication workflow."""
    db.db.otps = MagicMock()
    db.db.otps.delete_many = AsyncMock()
    db.db.otps.insert_one = AsyncMock()
    
    # 1. Send OTP
    send_payload = {"identifier": "+919876543210", "role": "citizen"}
    res1 = client.post("/auth/send-otp", json=send_payload)
    assert res1.status_code == 200
    data1 = res1.json()
    otp_code = "123456"

    # 2. Verify OTP
    db.db.otps.find_one = AsyncMock(return_value={
        "_id": "otp_123", "identifier": "+919876543210", "otp_code": otp_code, "role": "citizen"
    })
    db.db.otps.delete_one = AsyncMock()
    db.db.users.find_one = AsyncMock(return_value=None)
    db.db.users.insert_one = AsyncMock()

    verify_payload = {
        "identifier": "+919876543210",
        "otp_code": otp_code,
        "name": "OTP Test User",
        "role": "citizen"
    }
    res2 = client.post("/auth/verify-otp", json=verify_payload)
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["status"] == "success"
    assert "token" in data2
    assert data2["user"]["role"] == "citizen"

def test_evidence_hashing_and_upload():
    """Verify SHA-256 cryptographic evidence generation on media upload."""
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "officer_123", "role": "authority", "is_approved": True, "name": "Officer Patel"
    })
    headers = {"Authorization": "Bearer mock_token_authority_officer123"}
    fake_file_content = b"CRIME_SCENE_AUTHENTIC_CCTV_STREAM_BYTES"
    
    files = {"file": ("cctv_evidence.mp4", fake_file_content, "video/mp4")}
    
    with patch("app.routes.reports.upload_video", return_value={"url": "https://vault/cctv.mp4", "public_id": "cctv_1"}):
        res = client.post("/reports/upload-image", files=files, headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "sha256_hash" in data
        assert len(data["sha256_hash"]) == 64
        assert "evidence_record" in data
        assert data["evidence_record"]["is_sealed"] is True

def test_lodge_fir_and_audit_trail_continuity():
    """Verify deterministic FIR generation and tamper-proof audit chain progression."""
    report_id = ObjectId()
    mock_report = {
        "_id": report_id,
        "category": "Burglary",
        "description": "Store broken into at 2 AM",
        "status": "Pending",
        "firNumber": None,
        "auditTrail": [],
        "evidenceLedger": [],
        "createdBy": "Shopkeeper",
        "actualCreatedBy": "shopkeeper_123",
        "createdAt": datetime.now(timezone.utc),
        "updatedAt": datetime.now(timezone.utc)
    }

    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "admin_001", "role": "admin", "is_approved": True, "name": "Admin Sharma"
    })
    db.db.reports.find_one = AsyncMock(return_value=mock_report)
    db.db.reports.update_one = AsyncMock()

    headers = {"Authorization": "Bearer mock_token_admin_admin001"}
    fir_payload = {
        "police_station": "Indiranagar Police Station",
        "sections_of_law": ["BNS 305", "BNS 331"],
        "remarks": "Preliminary verification completed. Prima facie evidence confirmed."
    }

    res = client.post(f"/reports/{str(report_id)}/lodge-fir", json=fir_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert data["firNumber"].startswith("FIR-")
    assert "audit_block" in data
    assert data["audit_block"]["action"] == "FIR_LODGED"
    assert "block_hash" in data["audit_block"]

def test_whistleblower_anonymous_submission_and_lookup():
    """Verify zero-identity whistleblower creation and public claim tracking."""
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "anon_whistleblower", "role": "citizen", "is_approved": True, "name": "Deep Throat"
    })
    inserted_id = ObjectId()
    db.db.reports.insert_one = AsyncMock(return_value=MagicMock(inserted_id=inserted_id))

    headers = {"Authorization": "Bearer mock_token_citizen_anon_whistleblower"}
    payload = {
        "category": "Corruption",
        "description": "Bribe solicitation at city zoning office.",
        "emergencyFlag": False,
        "anonymityFlag": True,
        "whistleblowerMode": True,
        "location": {"lat": 12.97, "lng": 77.59, "address": "City Hall"}
    }

    with patch("app.routes.reports.reverse_geocode", AsyncMock(return_value="City Hall")):
        res = client.post("/reports", json=payload, headers=headers)
        assert res.status_code == 201
        data = res.json()
        assert data["whistleblowerMode"] is True
        assert data["whistleblowerToken"].startswith("WB-")
        claim_token = data["whistleblowerToken"]

    # Now verify public lookup by claim token
    db.db.reports.find_one = AsyncMock(return_value={
        "_id": inserted_id,
        "whistleblowerToken": claim_token,
        "category": "Corruption",
        "description": "Bribe solicitation at city zoning office.",
        "status": "Pending",
        "firNumber": "FIR-2026-1013-DEMO",
        "auditTrail": [],
        "evidenceLedger": []
    })

    wb_res = client.get(f"/reports/whistleblower/{claim_token}")
    assert wb_res.status_code == 200
    wb_data = wb_res.json()
    assert wb_data["claim_token"] == claim_token
    assert wb_data["category"] == "Corruption"
    assert wb_data["fir_number"] == "FIR-2026-1013-DEMO"

def test_anchor_report_onchain():
    """Verify EVM blockchain anchoring on Polygon Amoy testnet."""
    report_id = ObjectId()
    db.db.users.find_one = AsyncMock(return_value={
        "firebase_uid": "officer_amoy", "role": "authority", "is_approved": True, "name": "Inspector Rao"
    })
    db.db.reports.find_one = AsyncMock(return_value={
        "_id": report_id,
        "category": "Extortion",
        "description": "Evidence recorded on-scene",
        "status": "FIR Filed",
        "firNumber": "FIR-2026-1013-8A7B",
        "evidenceLedger": [{"sha256_hash": "a" * 64}],
        "auditTrail": [{"block_index": 0, "block_hash": "b" * 64}]
    })
    db.db.reports.update_one = AsyncMock()

    headers = {"Authorization": "Bearer mock_token_authority_officer_amoy"}
    res = client.post(f"/reports/{str(report_id)}/anchor-onchain", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "blockchain_receipt" in data
    assert data["blockchain_receipt"]["network"] == "Polygon Amoy Testnet"
    assert data["blockchain_receipt"]["transaction_hash"].startswith("0x")
    assert "amoy.polygonscan.com" in data["blockchain_receipt"]["explorer_url"]



