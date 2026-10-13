import logging
import socketio
from app.config import settings
from app.db import db

logger = logging.getLogger(__name__)

# Initialize Socket.IO AsyncServer
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")

@sio.event
async def connect(sid, environ, auth=None):
    """
    Triggered when a client connects.
    Verifies user token (Firebase or Mock) if provided in 'auth' payload: e.g., auth={"token": "..."}
    """
    logger.info(f"Socket connection attempt: {sid}")
    
    if not auth or "token" not in auth:
        # Allow connection but keep it unauthenticated (can be joined to general/public rooms)
        logger.info(f"Socket connected anonymously: {sid}")
        await sio.save_session(sid, {"authenticated": False})
        return True

    token = auth.get("token")
    uid = None
    role = "citizen"
    user_id = None

    # Verify token
    try:
        if settings.MOCK_AUTH_ENABLED and token.startswith("mock_token_"):
            remainder = token[len("mock_token_"):]
            parts = remainder.split("_", 2)
            role = parts[0] if len(parts) > 0 and parts[0] else "citizen"
            uid = parts[1] if len(parts) > 1 and parts[1] else "mock_user_123"
        else:
            # Import firebase admin dynamically to verify token
            from firebase_admin import auth as firebase_auth
            decoded_token = firebase_auth.verify_id_token(token)
            uid = decoded_token.get("uid")

        # Fetch user doc for verified role
        user = await db.users.find_one({"firebase_uid": uid})
        if user:
            role = user.get("role", "citizen")
            user_id = str(user.get("_id"))
            is_approved = user.get("is_approved", True)
            
            # Reject pending authorities
            if role == "authority" and not is_approved:
                logger.warning(f"Pending authority user {uid} rejected from Socket.IO connection.")
                return False
        else:
            logger.warning(f"Socket token verified but user {uid} not found in DB.")
            return False

        # Store session information
        session_data = {
            "authenticated": True,
            "firebase_uid": uid,
            "user_id": user_id,
            "role": role
        }
        await sio.save_session(sid, session_data)
        logger.info(f"Socket connected: {sid} (UID: {uid}, Role: {role})")

        # Join rooms based on role
        if role == "admin":
            await sio.enter_room(sid, "admins")
            await sio.enter_room(sid, "authorities")  # Admins also monitor authority feed
            logger.info(f"Socket {sid} joined 'admins' and 'authorities' rooms")
        elif role == "authority":
            await sio.enter_room(sid, "authorities")
            logger.info(f"Socket {sid} joined 'authorities' room")
        
        # All users join their own private room for direct notifications
        await sio.enter_room(sid, f"user_{uid}")
        logger.info(f"Socket {sid} joined room 'user_{uid}'")
        return True

    except Exception as e:
        logger.error(f"Socket connection authentication failed: {e}")
        # Reject connection
        return False

@sio.event
async def disconnect(sid):
    logger.info(f"Socket disconnected: {sid}")

class SocketManager:
    """Utility class to trigger socket broadcasts from endpoints."""
    
    @staticmethod
    async def broadcast_new_report(report: dict):
        """Notify all authorities and admins of a new report."""
        logger.info(f"Broadcasting new report: {report.get('_id')}")
        await sio.emit("new_report", report, room="authorities")

    @staticmethod
    async def broadcast_emergency_alert(report: dict):
        """Broadcast emergency warning to all connected clients."""
        logger.info(f"Broadcasting EMERGENCY alert: {report.get('_id')}")
        # Send to authorities/admins
        await sio.emit("emergency_alert", report, room="authorities")
        # Send to all connected clients
        await sio.emit("global_emergency", {
            "reportId": report.get("_id"),
            "category": report.get("category"),
            "location": report.get("location"),
            "message": f"EMERGENCY: New critical incident reported at {report.get('location', {}).get('address')}"
        })

    @staticmethod
    async def send_status_update(user_uid: str, report_id: str, new_status: str, message: str):
        """Notify the report creator when the report status is updated."""
        logger.info(f"Sending status update for report {report_id} to user {user_uid}")
        event_data = {
            "reportId": report_id,
            "status": new_status,
            "message": message
        }
        await sio.emit("status_changed", event_data, room=f"user_{user_uid}")

    @staticmethod
    async def broadcast_admin_notification(notification: dict):
        """Send notification to the admin review queue."""
        logger.info(f"Broadcasting admin notification: {notification.get('title')}")
        await sio.emit("admin_notification", notification, room="admins")

socket_manager = SocketManager()
