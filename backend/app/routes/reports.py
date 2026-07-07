import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from datetime import datetime
from bson import ObjectId
from bson.errors import InvalidId
from typing import Optional, List

from app.db import db
from app.firebase import get_current_user, RequireRole
from app.models.report import ReportCreate, ReportResponse, ReportStatus
from app.utils.geocoding import reverse_geocode
from app.utils.gemini import analyze_report_with_ai
from app.utils.socket_manager import socket_manager

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
    """Formats a database report document for public JSON serialization, honoring anonymity."""
    # Convert MongoDB ObjectId to string
    report_doc["_id"] = str(report_doc["_id"])
    
    # Exclude backend-only tracking field
    report_doc.pop("actualCreatedBy", None)
    
    # Handle anonymity masking
    if report_doc.get("anonymityFlag", False):
        report_doc["createdBy"] = "anonymous"
        
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

    # Geocoding resolution if address is omitted
    address = payload.location.address
    if not address or address.strip() == "":
        address = await reverse_geocode(payload.location.lat, payload.location.lng)

    # Prepare document structure
    now = datetime.utcnow()
    report_doc = {
        "category": payload.category,
        "description": payload.description,
        "emergencyFlag": payload.emergencyFlag,
        "anonymityFlag": payload.anonymityFlag,
        "mediaUrls": payload.mediaUrls,
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
        "actualCreatedBy": creator_uid,  # Kept internal for tracking and duplicate prevention
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
        "createdAt": datetime.utcnow()
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
            {"$inc": {"voteCount": 1}, "$set": {"updatedAt": datetime.utcnow()}},
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
        {"$set": {"status": status_update, "updatedAt": datetime.utcnow()}},
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
            "createdAt": datetime.utcnow()
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
        {"$set": {"isFlagged": True, "updatedAt": datetime.utcnow()}},
        return_document=True
    )

    # Notify admins
    admin_notif = {
        "title": "Report Flagged as Suspicious",
        "message": f"Authority flagged incident {id} ({report.get('category')}) as suspicious. Needs review.",
        "type": "admin_notification",
        "referenceId": id,
        "isRead": False,
        "createdAt": datetime.utcnow()
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
        {"$set": {"aiAnalysis": ai_analysis, "updatedAt": datetime.utcnow()}}
    )

    return ai_analysis
