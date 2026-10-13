import logging
import json
import os
from fastapi import Request, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.db import db

logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK if credentials exist
firebase_initialized = False

if settings.FIREBASE_CREDENTIALS_PATH and os.path.exists(settings.FIREBASE_CREDENTIALS_PATH):
    try:
        import firebase_admin
        from firebase_admin import credentials, auth
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)
        firebase_initialized = True
        logger.info("Firebase Admin SDK successfully initialized.")
    except Exception as e:
        logger.error(f"Error initializing Firebase Admin SDK: {e}")
else:
    logger.warning("Firebase credentials not found or invalid. Firebase Admin SDK not initialized.")

security = HTTPBearer(auto_error=False)

def parse_mock_token(token: str):
    """
    Parses mock token string.
    Expected format: mock_token_<role>_<uid>_<email> or mock_token_<role>_<uid>
    """
    if not token.startswith("mock_token_"):
        return None, None, None
    remainder = token[len("mock_token_"):]
    parts = remainder.split("_", 2)
    role = parts[0] if len(parts) > 0 and parts[0] else "citizen"
    uid = parts[1] if len(parts) > 1 and parts[1] else "mock_user_123"
    email = parts[2] if len(parts) > 2 and parts[2] else (uid if "@" in uid else f"{uid}@example.com")
    return role, uid, email

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to authenticate request and return the current user.
    Extracts Bearer token and verifies it with Firebase or Mock auth.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    uid = None
    email = None
    name = None

    # Handle OTP session tokens or Mock tokens
    if token.startswith("mock_token_") or token.startswith("trinetra_otp_"):
        try:
            mock_role, uid, email = parse_mock_token(token)
            existing_user = await db.users.find_one({"firebase_uid": uid})
            if existing_user:
                if not existing_user.get("is_active", True):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied. Your account has been suspended by the administrator.",
                    )
                return existing_user
            return {
                "firebase_uid": uid,
                "email": email or f"{uid}@example.com",
                "role": mock_role or "citizen",
                "name": email.split("@")[0] if email else "Mock User",
                "is_approved": (mock_role == "citizen" or mock_role == "admin"),
                "is_active": True
            }
        except HTTPException:
            raise
        except Exception:
            pass

    # Verify real Firebase token
    if not firebase_initialized:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK is not initialized. Cannot verify token.",
        )

    try:
        from firebase_admin import auth
        decoded_token = auth.verify_id_token(token)
        uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name", "")
    except Exception as e:
        logger.error(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Firebase authentication token.",
        )

    # Fetch user from database
    user = await db.users.find_one({"firebase_uid": uid})
    if not user:
        # User signed up in Firebase but hasn't completed onboarding sync
        # Return partial object so they can hit the sync endpoint
        return {
            "firebase_uid": uid,
            "email": email,
            "name": name,
            "role": "unregistered",
            "is_approved": False,
            "is_active": True
        }

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Your account has been suspended by the administrator.",
        )

    return user

class RequireRole:
    """Role-based access check dependency wrapper."""
    def __init__(self, allowed_roles: list[str], require_approval: bool = True):
        self.allowed_roles = allowed_roles
        self.require_approval = require_approval

    def __call__(self, current_user: dict = Depends(get_current_user)) -> dict:
        user_email = (current_user.get("email") or "").lower()
        if user_email == "anshshrivastav9480@gmail.com":
            # Superuser testing account has unrestricted access across all roles
            return current_user

        role = current_user.get("role")
        
        # Check if unregistered user wants to register
        if "unregistered" in self.allowed_roles and role == "unregistered":
            return current_user

        if role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {self.allowed_roles}.",
            )

        # Check approval for authorities
        if self.require_approval and role == "authority" and not current_user.get("is_approved", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Authority account is pending administrator approval.",
            )

        return current_user
