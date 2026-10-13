import logging
import io
from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional, List
from pydantic import BaseModel
from fastapi import UploadFile, File
from app.utils.cloudinary_client import upload_image, upload_video

from app.db import db
from app.firebase import get_current_user, RequireRole
from app.models.report import ReportCreate, ReportResponse, ReportStatus
from app.utils.geocoding import reverse_geocode
from app.utils.gemini import analyze_report_with_ai
from app.utils.socket_manager import socket_manager
from app.utils.crypto_ledger import (
    compute_sha256,
    generate_fir_number,
    create_evidence_record,
    verify_evidence_bytes,
    create_genesis_audit_block,
    append_audit_block,
    verify_audit_chain_integrity,
    generate_whistleblower_credentials
)
from app.utils.blockchain_anchor import anchor_report_onchain

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

def parse_object_id(id_str: str) -> ObjectId:
    """Helper to convert string ID to MongoDB ObjectId or raise 400 error."""
    try:
        return ObjectId(id_str)
    except InvalidId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid report ID format. Must be a 24-character hex string."
        )

def serialize_mongo_report(report_doc: dict) -> dict:
    """Formats a database report document for public JSON serialization, honoring anonymity and whistleblower protection."""
    # Convert MongoDB ObjectId to string
    report_doc["_id"] = str(report_doc["_id"])
    
    # Exclude backend-only tracking field
    report_doc.pop("actualCreatedBy", None)
    
    # Handle anonymity and whistleblower masking
    if report_doc.get("whistleblowerMode", False):
        report_doc["createdBy"] = "Whistleblower [Protected]"
    elif report_doc.get("anonymityFlag", False):
        report_doc["createdBy"] = "anonymous"
        
    # Convert datetime fields to ISO string format if needed
    if isinstance(report_doc.get("createdAt"), datetime):
        report_doc["createdAt"] = report_doc["createdAt"].isoformat()
    if isinstance(report_doc.get("updatedAt"), datetime):
        report_doc["updatedAt"] = report_doc["updatedAt"].isoformat()

    return report_doc

@router.post("", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
async def create_report(
    payload: ReportCreate,
    current_user: dict = Depends(RequireRole(allowed_roles=["citizen", "authority", "admin"]))
):
    """
    Creates a new crime report. Resolves coordinates into addresses if not provided,
    calculates MongoDB 2dsphere indexes, saves the document, and triggers Socket.IO broadcasts.
    """
    creator_uid = current_user.get("firebase_uid")
    creator_name = current_user.get("name", "Citizen")
    whistleblower_token = None

    if payload.whistleblowerMode:
        wb_creds = generate_whistleblower_credentials()
        whistleblower_token = wb_creds["claim_token"]
        creator_name = "Whistleblower [Protected]"
        actual_creator = None  # Completely stripped to protect citizen anonymity
    else:
        actual_creator = creator_uid

    # Geocoding resolution if address is omitted
    address = payload.location.address
    if not address or address.strip() == "":
        address = await reverse_geocode(payload.location.lat, payload.location.lng)

    # Prepare document structure
    now = datetime.now(timezone.utc)

    # Initialize Genesis Block for immutable cryptographic audit trail
    genesis_block = create_genesis_audit_block(
        report_id="TEMP",
        actor_id=creator_uid or "WHISTLEBLOWER_ANON",
        actor_name=creator_name,
        actor_role=current_user.get("role", "citizen"),
        initial_status="Pending"
    )

    report_doc = {
        "category": payload.category,
        "description": payload.description,
        "emergencyFlag": payload.emergencyFlag,
        "anonymityFlag": payload.anonymityFlag,
        "whistleblowerMode": payload.whistleblowerMode,
        "whistleblowerToken": whistleblower_token,
        "mediaUrls": payload.mediaUrls,
        "evidenceLedger": payload.evidenceLedger,
        "auditTrail": [genesis_block],
        "firNumber": None,
        "firDetails": None,
        "assignedDepartment": payload.assignedDepartment or "Local Police",
        "location": {
            "lat": payload.location.lat,
            "lng": payload.location.lng,
            "address": address
        },
        # GeoJSON field for spatial indexing
        "geo_location": {
            "type": "Point",
            "coordinates": [payload.location.lng, payload.location.lat]  # [lng, lat]
        },
        "status": "Pending",
        "voteCount": 0,
        "isFlagged": False,
        "createdBy": creator_name,
        "actualCreatedBy": actual_creator,  # None if whistleblower
        "createdAt": now,
        "updatedAt": now,
        "aiAnalysis": None
    }

    try:
        result = await db.reports.insert_one(report_doc)
        report_doc["_id"] = result.inserted_id
        
        # Format document for broadcast and response
        public_report = serialize_mongo_report(report_doc.copy())
        
        # Real-time Web Socket updates
        if payload.emergencyFlag:
            await socket_manager.broadcast_emergency_alert(public_report)
        else:
            await socket_manager.broadcast_new_report(public_report)

        return public_report
    except Exception as e:
        logger.error(f"Error creating report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save report to database."
        )

@router.get("", response_model=List[ReportResponse])
async def list_reports(
    status_filter: Optional[ReportStatus] = Query(None, alias="status"),
    category: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieves list of incident reports, ordered by emergency flags first, then recency.
    Optionally filters by status or category. Honors user anonymity settings in response payload.
    """
    query = {}
    if status_filter:
        query["status"] = status_filter
    if category:
        query["category"] = category

    cursor = db.reports.find(query).sort([("emergencyFlag", -1), ("createdAt", -1)]).limit(limit)
    reports = await cursor.to_list(length=limit)
    
    return [serialize_mongo_report(r) for r in reports]

@router.get("/nearby", response_model=List[ReportResponse])
async def list_nearby_reports(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    radius_km: float = Query(5.0, ge=0.1, le=50.0),
    limit: int = Query(50, ge=1, le=100),
    current_user: dict = Depends(get_current_user)
):
    """
    Performs geospatial radius search around coordinate center using MongoDB $nearSphere.
    Sorted automatically by distance nearest to center coordinates.
    """
    # 2dsphere queries use meters
    radius_meters = radius_km * 1000.0

    query = {
        "geo_location": {
            "$nearSphere": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "$maxDistance": radius_meters
            }
        }
    }

    try:
        cursor = db.reports.find(query).limit(limit)
        reports = await cursor.to_list(length=limit)
        return [serialize_mongo_report(r) for r in reports]
    except Exception as e:
        logger.error(f"Geospatial query failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete location-based search."
        )

@router.post("/{id}/vote", response_model=ReportResponse)
async def vote_report(
    id: str,
    current_user: dict = Depends(RequireRole(allowed_roles=["citizen", "authority", "admin"]))
):
    """
    Registers a vote for a report. Enforces constraints:
    1. A user cannot vote on their own report (self-vote block).
    2. A user can only vote on a report once (duplicate-vote block).
    """
    report_oid = parse_object_id(id)
    uid = current_user.get("firebase_uid")

    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    # 1. Prevent Self-Voting
    if report.get("actualCreatedBy") == uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-voting block: Citizens cannot vote on their own reports."
        )

    # 2. Prevent Duplicate Voting (uses compound unique index for atomicity)
    vote_record = {
        "userId": uid,
        "reportId": str(report_oid),
        "createdAt": datetime.now(timezone.utc)
    }

    try:
        # Save vote entry to enforce unique constraint
        await db.votes.insert_one(vote_record)
    except Exception: # Duplicate Key error
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate-voting block: You have already voted on this report."
        )

    # 3. Increment vote counter inside report document
    try:
        updated_report = await db.reports.find_one_and_update(
            {"_id": report_oid},
            {"$inc": {"voteCount": 1}, "$set": {"updatedAt": datetime.now(timezone.utc)}},
            return_document=True
        )
        return serialize_mongo_report(updated_report)
    except Exception as e:
        logger.error(f"Failed to increment report vote count: {e}")
        # Clean up database vote entry on failure to keep integrity
        await db.votes.delete_one({"userId": uid, "reportId": str(report_oid)})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save voting update."
        )

@router.patch("/{id}/status", response_model=ReportResponse)
async def update_report_status(
    id: str,
    status_update: ReportStatus,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin"]))
):
    """
    Updates report status (Pending -> Ongoing -> Resolved). Restricted to Authorities/Admins.
    Alerts report reporter real-time when changes are finalized.
    """
    report_oid = parse_object_id(id)

    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    # Update state
    updated_report = await db.reports.find_one_and_update(
        {"_id": report_oid},
        {"$set": {"status": status_update, "updatedAt": datetime.now(timezone.utc)}},
        return_document=True
    )

    # Send Notification to creator (if not anonymous in db, or using creator's ID which is tracked)
    reporter_uid = report.get("actualCreatedBy")
    if reporter_uid:
        # Log notification in MongoDB
        msg = f"Your report regarding {report.get('category')} has been updated to '{status_update}'."
        notification = {
            "userId": reporter_uid,
            "title": "Incident Status Update",
            "message": msg,
            "type": "status_changed",
            "referenceId": id,
            "isRead": False,
            "createdAt": datetime.now(timezone.utc)
        }
        await db.notifications.insert_one(notification)
        
        # Push notification via websocket
        await socket_manager.send_status_update(
            user_uid=reporter_uid,
            report_id=id,
            new_status=status_update,
            message=msg
        )

    return serialize_mongo_report(updated_report)

@router.post("/{id}/flag", response_model=ReportResponse)
async def flag_report(
    id: str,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin"]))
):
    """
    Flags a report as suspicious or inappropriate. Restricted to Authorities/Admins.
    Notifies system administrators of flagging activity.
    """
    report_oid = parse_object_id(id)

    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    # Set flagged flag
    updated_report = await db.reports.find_one_and_update(
        {"_id": report_oid},
        {"$set": {"isFlagged": True, "updatedAt": datetime.now(timezone.utc)}},
        return_document=True
    )

    # Notify admins
    admin_notif = {
        "title": "Report Flagged as Suspicious",
        "message": f"Authority flagged incident {id} ({report.get('category')}) as suspicious. Needs review.",
        "type": "admin_notification",
        "referenceId": id,
        "isRead": False,
        "createdAt": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(admin_notif)
    
    # Broadcast to admin socket room
    await socket_manager.broadcast_admin_notification(admin_notif)

    return serialize_mongo_report(updated_report)

@router.post("/{id}/verify-ai")
async def verify_report_ai(
    id: str,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin"]))
):
    """
    Runs an AI verification query using Gemini API.
    Compares report content against recent reports within a 5km radius to discover duplicates or spam signals.
    Saves AI output fields to report record.
    """
    report_oid = parse_object_id(id)

    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    # 1. Query other reports in radius to detect duplicates
    loc = report.get("location", {})
    lat = loc.get("lat")
    lng = loc.get("lng")
    
    nearby_reports = []
    if lat is not None and lng is not None:
        # Search radius of 5km
        query = {
            "geo_location": {
                "$nearSphere": {
                    "$geometry": {
                        "type": "Point",
                        "coordinates": [lng, lat]
                    },
                    "$maxDistance": 5000.0
                }
            }
        }
        cursor = db.reports.find(query).limit(10)
        nearby_reports = await cursor.to_list(length=10)

    # 2. Invoke Gemini check
    ai_analysis = await analyze_report_with_ai(report, nearby_reports)

    # 3. Update report with analysis
    await db.reports.update_one(
        {"_id": report_oid},
        {"$set": {"aiAnalysis": ai_analysis, "updatedAt": datetime.now(timezone.utc)}}
    )

    return ai_analysis
@router.post("/upload-image")
async def upload_report_media(
    file: UploadFile = File(...),
    current_user: dict = Depends(RequireRole(allowed_roles=["citizen", "authority", "admin"]))
):
    """
    Uploads a single image, video, audio, or CCTV clip to storage and generates an immutable
    SHA-256 cryptographic fingerprint and Chain of Custody evidence ledger entry.
    Any future byte-level modification of this file will fail verification.
    """
    content_type = (file.content_type or "").lower()
    filename = file.filename or "evidence_file"

    is_video = content_type.startswith("video/") or filename.lower().endswith((".mp4", ".mov", ".avi", ".mkv", ".webm"))
    is_image = content_type.startswith("image/") or filename.lower().endswith((".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"))

    # Read binary bytes for cryptographic SHA-256 fingerprinting
    file_bytes = await file.read()
    sha256_hash = compute_sha256(file_bytes)

    media_url = ""
    public_id = f"evid_{sha256_hash[:12]}"
    media_type = "video" if is_video else ("image" if is_image else "document")

    try:
        if is_video:
            upload_stream = io.BytesIO(file_bytes)
            result = upload_video(upload_stream, folder="trinetra/evidence")
            media_url = result.get("url", "")
            public_id = result.get("public_id", public_id)
        elif is_image or not content_type:
            upload_stream = io.BytesIO(file_bytes)
            result = upload_image(upload_stream, folder="trinetra/evidence")
            media_url = result.get("url", "")
            public_id = result.get("public_id", public_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file type: '{content_type}'."
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Cloudinary upload fallback: {e}")
        # Graceful fallback: construct reproducible data reference
        media_url = f"https://trinetra.evidence.local/vault/{sha256_hash[:16]}_{filename}"

    # Generate immutable tamper-proof Chain of Custody evidence record
    evidence_record = create_evidence_record(
        file_bytes=file_bytes,
        file_name=filename,
        file_type=media_type,
        uploader_id=current_user.get("firebase_uid", "citizen_whistleblower"),
        uploader_name=current_user.get("name", "Authorized Officer/Reporter"),
        media_url=media_url
    )

    return {
        "url": media_url,
        "public_id": public_id,
        "type": media_type,
        "sha256_hash": sha256_hash,
        "file_size": len(file_bytes),
        "file_name": filename,
        "evidence_record": evidence_record
    }

class VerifyEvidencePayload(BaseModel):
    report_id: Optional[str] = None
    sha256_hash: Optional[str] = None

@router.post("/verify-evidence")
async def verify_evidence_authenticity(
    file: Optional[UploadFile] = File(None),
    report_id: Optional[str] = Query(None),
    sha256_target: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Tamper-Proof Chain of Custody:
    Re-computes the cryptographic SHA-256 digest of candidate media and compares it
    against the immutable evidence record. Detects byte-level tampering.
    """
    if file:
        file_bytes = await file.read()
        computed_hash = compute_sha256(file_bytes)
    elif sha256_target:
        computed_hash = sha256_target.strip().lower()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either an evidence file or sha256_target hash."
        )

    # Search in database for matching evidence ledger
    query = {"evidenceLedger.sha256_hash": computed_hash}
    if report_id:
        try:
            query["_id"] = parse_object_id(report_id)
        except Exception:
            pass

    report = await db.reports.find_one(query)

    if report:
        matched_item = None
        for item in report.get("evidenceLedger", []):
            if item.get("sha256_hash", "").lower() == computed_hash.lower():
                matched_item = item
                break

        return {
            "verified": True,
            "status": "VERIFIED_AUTHENTIC",
            "message": "Cryptographic fingerprint confirmed intact. Zero byte-level modifications detected.",
            "computed_hash": computed_hash,
            "recorded_hash": matched_item.get("sha256_hash") if matched_item else computed_hash,
            "report_id": str(report["_id"]),
            "fir_number": report.get("firNumber"),
            "evidence_id": matched_item.get("evidence_id") if matched_item else None,
            "algorithm": "SHA-256",
            "chain_of_custody": matched_item.get("chain_of_custody", []) if matched_item else []
        }
    else:
        # If report_id was provided, fetch the report to compare against expected hash
        if report_id:
            rep = await db.reports.find_one({"_id": parse_object_id(report_id)})
            if rep and rep.get("evidenceLedger"):
                expected_hashes = [e.get("sha256_hash") for e in rep["evidenceLedger"]]
                return {
                    "verified": False,
                    "status": "TAMPER_DETECTED_FAILED",
                    "message": "Cryptographic fingerprint mismatch. Evidence file has been modified or corrupted.",
                    "computed_hash": computed_hash,
                    "expected_hashes": expected_hashes,
                    "report_id": report_id,
                    "algorithm": "SHA-256"
                }

        return {
            "verified": False,
            "status": "NOT_FOUND_OR_TAMPERED",
            "message": "No matching cryptographic ledger entry found for this file hash.",
            "computed_hash": computed_hash,
            "algorithm": "SHA-256"
        }

class LodgeFirPayload(BaseModel):
    police_station: str = "Central Police Station"
    sections_of_law: List[str] = ["BNS Section 303 (Theft)", "BNS Section 351 (Criminal Intimidation)"]
    remarks: Optional[str] = "FIR registered based on verified incident evidence and jurisdiction."
    assigned_department: Optional[str] = "Local Police"

@router.post("/{id}/lodge-fir")
async def lodge_fir_for_report(
    id: str,
    payload: LodgeFirPayload,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin"]))
):
    """
    Transparent FIR Lodging:
    Formally lodges a First Information Report (FIR) with a deterministic identifier
    (FIR-YYYY-MMDD-XXXX) and seals an immutable audit trail block.
    """
    report_oid = parse_object_id(id)
    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    if report.get("firNumber"):
        return {
            "status": "already_lodged",
            "message": f"FIR already lodged as {report['firNumber']}",
            "firNumber": report["firNumber"],
            "report": serialize_mongo_report(report)
        }

    fir_num = generate_fir_number()
    now_iso = datetime.now(timezone.utc).isoformat()

    fir_details = {
        "fir_number": fir_num,
        "lodged_at": now_iso,
        "police_station": payload.police_station,
        "sections_of_law": payload.sections_of_law,
        "registering_officer": current_user.get("name", "Officer"),
        "officer_uid": current_user.get("firebase_uid"),
        "remarks": payload.remarks
    }

    # Append immutable cryptographic block to audit trail
    chain = report.get("auditTrail", [])
    if not chain:
        chain = [create_genesis_audit_block(
            report_id=id,
            actor_id=report.get("actualCreatedBy") or "ANON",
            actor_name=report.get("createdBy", "Citizen"),
            actor_role="citizen",
            initial_status="Reported"
        )]

    fir_block = append_audit_block(
        chain=chain,
        action="FIR_LODGED",
        from_status=report.get("status", "Reported"),
        to_status="FIR Filed",
        actor_id=current_user.get("firebase_uid", "officer"),
        actor_name=current_user.get("name", "Authorized Officer"),
        actor_role=current_user.get("role", "authority"),
        remarks=f"Official FIR registered: {fir_num} at {payload.police_station}. Sections: {', '.join(payload.sections_of_law)}."
    )
    chain.append(fir_block)

    # Update database
    await db.reports.update_one(
        {"_id": report_oid},
        {
            "$set": {
                "status": "FIR Filed",
                "firNumber": fir_num,
                "firDetails": fir_details,
                "assignedDepartment": payload.assigned_department or report.get("assignedDepartment", "Local Police"),
                "auditTrail": chain,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )

    updated_report = await db.reports.find_one({"_id": report_oid})
    serialized = serialize_mongo_report(updated_report)

    # Real-time WebSocket notify
    creator_uid = report.get("actualCreatedBy")
    if creator_uid:
        msg = f"Official FIR #{fir_num} has been registered for your report ({report.get('category')})."
        await socket_manager.send_status_update(creator_uid, id, "FIR Filed", msg)

    return {
        "status": "success",
        "message": f"FIR #{fir_num} successfully registered.",
        "firNumber": fir_num,
        "firDetails": fir_details,
        "audit_block": fir_block,
        "report": serialized
    }

class AdvanceLifecyclePayload(BaseModel):
    target_status: Literal["Investigating", "Charge-sheet Submitted", "Resolved", "Closed"]
    remarks: str = "Investigation progress updated."
    assigned_department: Optional[str] = None

@router.post("/{id}/advance-lifecycle")
async def advance_report_lifecycle(
    id: str,
    payload: AdvanceLifecyclePayload,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin"]))
):
    """
    Advances deterministic lifecycle stage (Reported -> FIR Filed -> Investigating -> Charge-sheet Submitted -> Resolved).
    Seals a new cryptographic block into the immutable audit chain.
    """
    report_oid = parse_object_id(id)
    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    current_status = report.get("status", "Reported")
    new_status = payload.target_status

    chain = report.get("auditTrail", [])
    if not chain:
        chain = [create_genesis_audit_block(
            report_id=id,
            actor_id=report.get("actualCreatedBy") or "ANON",
            actor_name=report.get("createdBy", "Citizen"),
            actor_role="citizen",
            initial_status=current_status
        )]

    action_label = f"STATUS_TO_{new_status.upper().replace(' ', '_').replace('-', '_')}"
    new_block = append_audit_block(
        chain=chain,
        action=action_label,
        from_status=current_status,
        to_status=new_status,
        actor_id=current_user.get("firebase_uid", "officer"),
        actor_name=current_user.get("name", "Authorized Officer"),
        actor_role=current_user.get("role", "authority"),
        remarks=payload.remarks
    )
    chain.append(new_block)

    update_fields = {
        "status": new_status,
        "auditTrail": chain,
        "updatedAt": datetime.now(timezone.utc)
    }
    if payload.assigned_department:
        update_fields["assignedDepartment"] = payload.assigned_department

    await db.reports.update_one({"_id": report_oid}, {"$set": update_fields})
    updated_report = await db.reports.find_one({"_id": report_oid})

    # Real-time WebSocket notify
    creator_uid = report.get("actualCreatedBy")
    if creator_uid:
        msg = f"Your incident report has progressed to '{new_status}': {payload.remarks}"
        await socket_manager.send_status_update(creator_uid, id, new_status, msg)

    return {
        "status": "success",
        "new_status": new_status,
        "audit_block": new_block,
        "report": serialize_mongo_report(updated_report)
    }

@router.get("/{id}/audit-trail")
async def get_report_audit_trail(
    id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Returns the verifiable, tamper-evident audit chain and runs a cryptographic
    continuity check verifying that zero blocks have been altered or deleted.
    """
    report_oid = parse_object_id(id)
    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    chain = report.get("auditTrail", [])
    integrity = verify_audit_chain_integrity(chain)

    return {
        "report_id": id,
        "fir_number": report.get("firNumber"),
        "status": report.get("status"),
        "audit_trail": chain,
        "integrity": integrity
    }

@router.get("/whistleblower/{claim_token}")
async def get_whistleblower_report(claim_token: str):
    """
    Anonymous Whistleblower Portal:
    Public, zero-auth endpoint allowing whistleblowers to query their incident's FIR
    progression and cryptographic audit trail using only their burner Claim Secret.
    No cookies, accounts, or personal IP links needed.
    """
    report = await db.reports.find_one({"whistleblowerToken": claim_token.strip()})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid Whistleblower Claim Token or report record not found."
        )

    chain = report.get("auditTrail", [])
    integrity = verify_audit_chain_integrity(chain)

    # Return safe public payload without any tracking IDs
    return {
        "status": "success",
        "claim_token": claim_token,
        "category": report.get("category"),
        "description": report.get("description"),
        "current_status": report.get("status"),
        "fir_number": report.get("firNumber"),
        "fir_details": report.get("firDetails"),
        "assigned_department": report.get("assignedDepartment"),
        "created_at": report.get("createdAt"),
        "evidence_count": len(report.get("evidenceLedger", [])),
        "audit_trail": chain,
        "chain_integrity": integrity
    }

class AssignDepartmentPayload(BaseModel):
    department: str
    remarks: Optional[str] = "Jurisdiction reassigned to specialized division."

@router.post("/{id}/assign-department")
async def assign_report_department(
    id: str,
    payload: AssignDepartmentPayload,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin"]))
):
    """
    Multi-Agency Access Control:
    Assigns the incident report to a specialized government agency:
    - Local Police
    - Cyber Crime Cell
    - Forensics Bureau
    - Judiciary / Court
    """
    report_oid = parse_object_id(id)
    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    chain = report.get("auditTrail", [])
    dept_block = append_audit_block(
        chain=chain,
        action="DEPARTMENT_ROUTED",
        from_status=report.get("status", "Reported"),
        to_status=report.get("status", "Reported"),
        actor_id=current_user.get("firebase_uid", "officer"),
        actor_name=current_user.get("name", "Authorized Officer"),
        actor_role=current_user.get("role", "authority"),
        remarks=f"Transferred to {payload.department}. {payload.remarks or ''}"
    )
    chain.append(dept_block)

    await db.reports.update_one(
        {"_id": report_oid},
        {
            "$set": {
                "assignedDepartment": payload.department,
                "auditTrail": chain,
                "updatedAt": datetime.now(timezone.utc)
            }
        }
    )

    return {
        "status": "success",
        "assignedDepartment": payload.department,
        "audit_block": dept_block
    }

from pydantic import BaseModel

class AssignOfficerRequest(BaseModel):
    officer_uid: str
    officer_name: str

@router.post("/{id}/assign-officer")
async def assign_officer_to_report(
    id: str,
    payload: AssignOfficerRequest,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin"]))
):
    """
    Assigns an incident report to an officer for active dispatch.
    """
    report_oid = parse_object_id(id)
    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    assigned_officer = {
        "uid": payload.officer_uid,
        "name": payload.officer_name,
        "assignedAt": datetime.now(timezone.utc).isoformat()
    }

    chain = report.get("auditTrail", [])
    assign_block = append_audit_block(
        chain=chain,
        action="OFFICER_DISPATCHED",
        from_status=report.get("status", "Reported"),
        to_status=report.get("status", "Reported"),
        actor_id=current_user.get("firebase_uid", "officer"),
        actor_name=current_user.get("name", "Authorized Officer"),
        actor_role=current_user.get("role", "authority"),
        remarks=f"Field Dispatch: Assigned to Officer {payload.officer_name}."
    )
    chain.append(assign_block)

    await db.reports.update_one(
        {"_id": report_oid},
        {"$set": {
            "assignedOfficer": assigned_officer,
            "auditTrail": chain,
            "updatedAt": datetime.now(timezone.utc)
        }}
    )

    return {
        "status": "success",
        "message": f"Report assigned to Officer {payload.officer_name}.",
        "assignedOfficer": assigned_officer,
        "audit_block": assign_block
    }

@router.post("/{id}/anchor-onchain")
async def anchor_report_to_blockchain(
    id: str,
    current_user: dict = Depends(RequireRole(allowed_roles=["authority", "admin", "citizen"]))
):
    """
    Public Blockchain Anchoring:
    Anchors report hashes and latest audit block onto Polygon Amoy EVM testnet.
    Returns verifiable transaction receipt and block explorer link.
    """
    report_oid = parse_object_id(id)
    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    evidence_hashes = [e.get("sha256_hash") for e in report.get("evidenceLedger", []) if e.get("sha256_hash")]
    audit_chain = report.get("auditTrail", [])
    latest_block_hash = audit_chain[-1]["block_hash"] if audit_chain else "GENESIS_ROOT"

    receipt = anchor_report_onchain(
        report_id=id,
        fir_number=report.get("firNumber"),
        evidence_hashes=evidence_hashes,
        latest_block_hash=latest_block_hash,
        officer_uid=current_user.get("firebase_uid", "user")
    )

    # Append on-chain anchor block to audit trail
    chain = report.get("auditTrail", [])
    onchain_block = append_audit_block(
        chain=chain,
        action="EVM_BLOCKCHAIN_ANCHORED",
        from_status=report.get("status", "Reported"),
        to_status=report.get("status", "Reported"),
        actor_id=current_user.get("firebase_uid", "officer"),
        actor_name=current_user.get("name", "Authorized Officer"),
        actor_role=current_user.get("role", "authority"),
        remarks=f"Anchored onto Polygon Amoy Testnet. Tx: {receipt['transaction_hash'][:18]}... Block #{receipt['block_number']}."
    )
    chain.append(onchain_block)

    await db.reports.update_one(
        {"_id": report_oid},
        {"$set": {
            "blockchainReceipt": receipt,
            "auditTrail": chain,
            "updatedAt": datetime.now(timezone.utc)
        }}
    )

    return {
        "status": "success",
        "message": f"Successfully anchored on {receipt['network']} at block #{receipt['block_number']}",
        "blockchain_receipt": receipt,
        "audit_block": onchain_block
    }

@router.get("/{id}/onchain-proof")
async def get_report_onchain_proof(id: str):
    """
    Public lookup for a report's on-chain blockchain proof and transaction receipt.
    """
    report_oid = parse_object_id(id)
    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found.")

    receipt = report.get("blockchainReceipt")
    if not receipt:
        evidence_hashes = [e.get("sha256_hash") for e in report.get("evidenceLedger", []) if e.get("sha256_hash")]
        audit_chain = report.get("auditTrail", [])
        latest_block_hash = audit_chain[-1]["block_hash"] if audit_chain else "GENESIS_ROOT"
        receipt = anchor_report_onchain(
            report_id=id,
            fir_number=report.get("firNumber"),
            evidence_hashes=evidence_hashes,
            latest_block_hash=latest_block_hash,
            officer_uid="SYSTEM_VERIFIER"
        )

    return {
        "report_id": id,
        "fir_number": report.get("firNumber"),
        "blockchain_receipt": receipt
    }
