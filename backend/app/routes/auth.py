import logging
from fastapi import APIRouter, Depends, HTTPException, status
from datetime import datetime, timezone
from app.db import db
from app.firebase import get_current_user, RequireRole
from app.models.user import UserResponse, UserRole
from app.utils.otp_service import dispatch_otp

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

class SyncPayload(UserResponse.__annotations__.get("role", None) or object):
    # Dynamic sync model or simple input validation
    pass

from pydantic import BaseModel
from typing import Literal, Optional
import random

ADMIN_EMAIL = "anshshrivastav9480@gmail.com"

class OnboardRequest(BaseModel):
    role: Literal["citizen", "authority", "admin"]
    name: str

class SendOtpRequest(BaseModel):
    identifier: str
    role: Literal["citizen", "authority", "admin"] = "citizen"

class VerifyOtpRequest(BaseModel):
    identifier: str
    otp_code: str
    name: Optional[str] = None
    role: Literal["citizen", "authority", "admin"] = "citizen"



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
        # If user exists, update their profile fields (and role if superuser testing email)
        update_data = {
            "name": payload.name,
            "email": email,
        }
        if email.lower() == ADMIN_EMAIL.lower():
            update_data["role"] = payload.role
            update_data["is_approved"] = True

        await db.users.update_one(
            {"firebase_uid": uid},
            {"$set": update_data}
        )
        # Fetch updated user
        updated_user = await db.users.find_one({"firebase_uid": uid})
        return updated_user

    # Create new user record
    role = payload.role
    
    # Validation logic: Citizens auto-approve. Authorities start unapproved. Admins & Superuser are auto-approved.
    is_approved = True
    if email.lower() == ADMIN_EMAIL.lower():
        is_approved = True
    elif role == "authority":
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
        "createdAt": datetime.now(timezone.utc)
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
        "createdAt": datetime.now(timezone.utc)
    }
    await db.notifications.insert_one(notification)

    # Return updated user
    updated_user = await db.users.find_one({"firebase_uid": firebase_uid})
    return updated_user


@router.post("/send-otp")
async def send_otp(payload: SendOtpRequest):
    """
    Generates a 6-digit OTP code for a phone number or email identifier.
    Saves OTP record into MongoDB with automatic expiry.
    """
    clean_id = payload.identifier.strip().lower()
    if not clean_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mobile phone number or email identifier is required."
        )

    # Restrict Admin Role strictly to designated admin email
    if payload.role == "admin" and clean_id != ADMIN_EMAIL.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: Only designated Admin credentials can access the Admin control unit."
        )

    # Generate 6-digit code
    otp_code = f"{random.randint(100000, 999999)}"
    
    otp_record = {
        "identifier": clean_id,
        "otp_code": otp_code,
        "role": payload.role,
        "createdAt": datetime.now(timezone.utc)
    }

    # Store or update OTP record in DB
    await db.db.otps.delete_many({"identifier": clean_id})
    await db.db.otps.insert_one(otp_record)
    
    logger.info(f"Generated OTP [{otp_code}] for identifier {clean_id}")

    # Dispatch real OTP via Email or SMS
    dispatch_res = await dispatch_otp(clean_id, otp_code)

    return {
        "status": "success",
        "message": dispatch_res.get("message") or f"Verification OTP code sent to {payload.identifier}"
    }


@router.post("/verify-otp")
async def verify_otp(payload: VerifyOtpRequest):
    """
    Verifies 6-digit OTP code against stored records.
    Upon verification, logs in or registers user profile and returns access credentials.
    """
    clean_id = payload.identifier.strip().lower()
    clean_otp = payload.otp_code.strip()

    otp_doc = await db.db.otps.find_one({"identifier": clean_id, "otp_code": clean_otp})
    if not otp_doc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP verification code."
        )

    # Delete used OTP
    await db.db.otps.delete_one({"_id": otp_doc["_id"]})

    # Derive UID and Email
    uid = f"otpuser{abs(hash(clean_id)) % 10000000}"
    email = clean_id if "@" in clean_id else f"{clean_id}@phone.trinetra"
    user_name = payload.name or f"User {clean_id[-4:] if len(clean_id) >= 4 else clean_id}"
    role = payload.role

    # Upsert user record
    existing_user = await db.users.find_one({"firebase_uid": uid})
    if not existing_user:
        is_approved = True if role in ["citizen", "admin"] or clean_id.lower() == ADMIN_EMAIL.lower() else False
        new_user = {
            "firebase_uid": uid,
            "email": email,
            "name": user_name,
            "role": role,
            "is_approved": is_approved,
            "is_active": True,
            "createdAt": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
        user_data = new_user
    else:
        if clean_id.lower() == ADMIN_EMAIL.lower():
            await db.users.update_one({"firebase_uid": uid}, {"$set": {"role": role, "is_approved": True}})
            existing_user["role"] = role
            existing_user["is_approved"] = True
        user_data = existing_user

    # Generate token format
    token = f"mock_token_{role}_{uid}_{email}"

    return {
        "status": "success",
        "message": "OTP verification successful.",
        "token": token,
        "user": {
            "firebase_uid": uid,
            "email": email,
            "name": user_data.get("name"),
            "role": role,
            "is_approved": user_data.get("is_approved", True)
        }
    }

