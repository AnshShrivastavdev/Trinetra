import logging
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime
from app.db import db
from app.firebase import get_current_user, RequireRole
from app.models.user import UserResponse, UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

class SyncPayload(UserResponse.__annotations__.get("role", None) or object):
    # Dynamic sync model or simple input validation
    pass

from pydantic import BaseModel
from typing import Literal
class OnboardRequest(BaseModel):
    role: Literal["citizen", "authority"]
    name: str

@router.post("/sync", response_model=UserResponse)
async def sync_user(
    payload: OnboardRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Onboards or updates a user in MongoDB with their requested role.
    For unregistered Firebase users, creates a MongoDB profile.
    'citizen' accounts are auto-approved. 'authority' accounts start as pending approval (is_approved=False).
    """
    uid = current_user.get("firebase_uid")
    email = current_user.get("email")

    if not uid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incomplete user credentials from auth provider."
        )

    # Check if user already exists
    user_in_db = await db.users.find_one({"firebase_uid": uid})

    if user_in_db:
        # If user exists, update their profile fields (name, but not role once onboarded)
        update_data = {
            "name": payload.name,
            "email": email,
        }
        await db.users.update_one(
            {"firebase_uid": uid},
            {"$set": update_data}
        )
        # Fetch updated user
        updated_user = await db.users.find_one({"firebase_uid": uid})
        return updated_user

    # Create new user record
    role = payload.role
    
    # Validation logic: Citizens auto-approve. Authorities start unapproved. Admins are auto-approved.
    is_approved = True
    if role == "authority":
        is_approved = False
    elif role == "admin":
        is_approved = True

    new_user = {
        "firebase_uid": uid,
        "email": email,
        "name": payload.name,
        "role": role,
        "is_approved": is_approved,
        "is_active": True,
        "createdAt": datetime.utcnow()
    }

    try:
        result = await db.users.insert_one(new_user)
        new_user["_id"] = result.inserted_id
        logger.info(f"Successfully onboarded user {email} as role '{role}'")
        return new_user
    except Exception as e:
        logger.error(f"Error saving user to DB: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to register user details in database."
        )

@router.get("/me", response_model=UserResponse)
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    """Returns the profile of the current authenticated user."""
    # Check if user is fully onboarded
    if current_user.get("role") == "unregistered":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is registered on Auth provider but not yet synced with database. Please onboard."
        )
    return current_user

@router.get("/authority/pending", response_model=list[UserResponse])
async def list_pending_authorities(
    admin_user: dict = Depends(RequireRole(allowed_roles=["admin"]))
):
    """Admin-only endpoint listing all pending authority profiles."""
    cursor = db.users.find({"role": "authority", "is_approved": False})
    pending_users = await cursor.to_list(length=100)
    return pending_users

@router.post("/authority/{firebase_uid}/approve", response_model=UserResponse)
async def approve_authority(
    firebase_uid: str,
    admin_user: dict = Depends(RequireRole(allowed_roles=["admin"]))
):
    """Admin-only endpoint approving a pending authority profile by Firebase UID."""
    user = await db.users.find_one({"firebase_uid": firebase_uid, "role": "authority"})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Authority user not found with specified Firebase UID."
        )

    if user.get("is_approved"):
        return user

    # Update approval
    await db.users.update_one(
        {"firebase_uid": firebase_uid},
        {"$set": {"is_approved": True}}
    )

    # Insert notification for authority
    notification = {
        "userId": firebase_uid,
        "title": "Account Approved",
        "message": "Your authority status has been approved by the system administrator. You now have dashboard access.",
        "type": "admin_notification",
        "referenceId": None,
        "isRead": False,
        "createdAt": datetime.utcnow()
    }
    await db.notifications.insert_one(notification)

    # Return updated user
    updated_user = await db.users.find_one({"firebase_uid": firebase_uid})
    return updated_user
