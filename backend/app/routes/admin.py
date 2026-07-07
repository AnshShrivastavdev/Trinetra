import logging
import csv
import io
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Literal
from bson import ObjectId
from datetime import datetime

from app.db import db
from app.firebase import RequireRole
from app.routes.reports import parse_object_id, serialize_mongo_report

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

class ReviewPayload(BaseModel):
    action: Literal["Fake Report", "Restored"]

@router.get("/stats")
async def get_system_stats(
    admin_user: dict = Depends(RequireRole(allowed_roles=["admin"]))
):
    """
    Returns administrative dashboard summary metrics.
    Includes totals for users (citizens/authorities), reports, status divisions, and flag counts.
    """
    try:
        # User counts
        citizen_count = await db.users.count_documents({"role": "citizen"})
        authority_total = await db.users.count_documents({"role": "authority"})
        authority_pending = await db.users.count_documents({"role": "authority", "is_approved": False})
        
        # Report counts
        report_total = await db.reports.count_documents({})
        report_flagged = await db.reports.count_documents({"isFlagged": True})
        
        # Breakdown by status
        status_pending = await db.reports.count_documents({"status": "Pending"})
        status_ongoing = await db.reports.count_documents({"status": "Ongoing"})
        status_resolved = await db.reports.count_documents({"status": "Resolved"})

        return {
            "users": {
                "citizens": citizen_count,
                "authorities": {
                    "total": authority_total,
                    "pending": authority_pending,
                    "approved": authority_total - authority_pending
                }
            },
            "reports": {
                "total": report_total,
                "flagged": report_flagged,
                "byStatus": {
                    "pending": status_pending,
                    "ongoing": status_ongoing,
                    "resolved": status_resolved
                }
            }
        }
    except Exception as e:
        logger.error(f"Error compiling admin stats: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to compile system metrics."
        )

@router.post("/reports/{id}/review")
async def review_flagged_report(
    id: str,
    payload: ReviewPayload,
    admin_user: dict = Depends(RequireRole(allowed_roles=["admin"]))
):
    """
    Admin-only review action on a flagged report.
    - 'Restored': Clears the isFlagged marker back to False.
    - 'Fake Report': Permanently deletes the report document from MongoDB.
    """
    report_oid = parse_object_id(id)

    report = await db.reports.find_one({"_id": report_oid})
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found."
        )

    if not report.get("isFlagged"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot review report. Incident is not flagged as suspicious."
        )

    if payload.action == "Restored":
        # Clear flagged state
        updated_report = await db.reports.find_one_and_update(
            {"_id": report_oid},
            {"$set": {"isFlagged": False, "updatedAt": datetime.utcnow()}},
            return_document=True
        )
        logger.info(f"Admin restored flagged report: {id}")
        return {
            "status": "success",
            "message": "Report flag cleared successfully.",
            "report": serialize_mongo_report(updated_report)
        }

    elif payload.action == "Fake Report":
        # Delete report from DB
        await db.reports.delete_one({"_id": report_oid})
        # Remove any voting logs associated with this report
        await db.votes.delete_many({"reportId": id})
        
        logger.info(f"Admin deleted fake report: {id}")
        return {
            "status": "success",
            "message": "Fake report permanently deleted."
        }

@router.get("/export/csv")
async def export_data_csv(
    type: Literal["citizens", "authorities", "resolved_reports"],
    admin_user: dict = Depends(RequireRole(allowed_roles=["admin"]))
):
    """
    Exports collection data to a downloadable CSV file.
    Only accessible by users with the 'admin' role.
    """
    output = io.StringIO()
    writer = csv.writer(output)

    if type == "citizens":
        # Export citizen data
        writer.writerow(["firebase_uid", "name", "email", "createdAt"])
        cursor = db.users.find({"role": "citizen"})
        async for u in cursor:
            writer.writerow([
                u.get("firebase_uid", ""),
                u.get("name", ""),
                u.get("email", ""),
                u.get("createdAt", "")
            ])
        filename = "citizens.csv"

    elif type == "authorities":
        # Export authority data
        writer.writerow(["firebase_uid", "name", "email", "is_approved", "createdAt"])
        cursor = db.users.find({"role": "authority"})
        async for u in cursor:
            writer.writerow([
                u.get("firebase_uid", ""),
                u.get("name", ""),
                u.get("email", ""),
                u.get("is_approved", False),
                u.get("createdAt", "")
            ])
        filename = "authorities.csv"

    elif type == "resolved_reports":
        # Export resolved cases/reports
        writer.writerow([
            "report_id", "category", "description", "emergencyFlag", 
            "anonymityFlag", "lat", "lng", "address", "voteCount", 
            "isFlagged", "createdBy", "createdAt", "updatedAt"
        ])
        cursor = db.reports.find({"status": "Resolved"})
        async for r in cursor:
            loc = r.get("location", {})
            writer.writerow([
                str(r.get("_id", "")),
                r.get("category", ""),
                r.get("description", ""),
                r.get("emergencyFlag", False),
                r.get("anonymityFlag", False),
                loc.get("lat", ""),
                loc.get("lng", ""),
                loc.get("address", ""),
                r.get("voteCount", 0),
                r.get("isFlagged", False),
                r.get("createdBy", ""),
                r.get("createdAt", ""),
                r.get("updatedAt", "")
            ])
        filename = "resolved_reports.csv"

    # Reset buffer position
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/users/{firebase_uid}/toggle-active")
async def toggle_user_active(
    firebase_uid: str,
    admin_user: dict = Depends(RequireRole(allowed_roles=["admin"]))
):
    """
    Admin-only endpoint to toggle account status (is_active True <-> False).
    Suspends or reactivates a user's API authorization.
    """
    user = await db.users.find_one({"firebase_uid": firebase_uid})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found with specified Firebase UID."
        )

    # Admins cannot disable themselves
    if firebase_uid == admin_user.get("firebase_uid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-suspension block: Admin cannot disable their own account."
        )

    new_active_status = not user.get("is_active", True)
    await db.users.update_one(
        {"firebase_uid": firebase_uid},
        {"$set": {"is_active": new_active_status}}
    )

    action_word = "reactivated" if new_active_status else "suspended"
    logger.info(f"Admin has {action_word} user account: {firebase_uid}")
    
    return {
        "status": "success",
        "message": f"User account successfully {action_word}.",
        "is_active": new_active_status
    }

@router.delete("/users/{firebase_uid}")
async def remove_user(
    firebase_uid: str,
    admin_user: dict = Depends(RequireRole(allowed_roles=["admin"]))
):
    """
    Admin-only endpoint to permanently delete a user profile from the database.
    """
    user = await db.users.find_one({"firebase_uid": firebase_uid})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found."
        )

    # Admins cannot delete themselves
    if firebase_uid == admin_user.get("firebase_uid"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Self-deletion block: Admin cannot delete their own account."
        )

    # Remove user document
    await db.users.delete_one({"firebase_uid": firebase_uid})
    
    # Remove any voting logs associated with this user
    await db.votes.delete_many({"userId": firebase_uid})
    
    logger.info(f"Admin permanently deleted user account: {firebase_uid}")
    return {
        "status": "success",
        "message": "User and associated voting records permanently deleted."
    }
