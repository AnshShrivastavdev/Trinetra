import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import socketio

from app.config import settings
from app.db import db
from app.utils.socket_manager import sio
from app.routes import auth, reports, admin

# Setup Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handles startup and shutdown events for the application."""
    # Startup: Initialize MongoDB and create indexes
    await db.connect_db()
    yield
    # Shutdown: Close database connections
    await db.close_db()

# Initialize FastAPI application
app = FastAPI(
    title="Trinetra - Smart Crime Reporting System Backend",
    description="Real-time incident reporting, spatial queries, and AI validation system.",
    version="1.0.0",
    lifespan=lifespan
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=()"
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Parse configured allowed CORS origins
allowed_origins_list = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins_list if allowed_origins_list else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(admin.router)

import time

START_TIME = time.time()

@app.get("/")
@app.get("/health")
async def health_check():
    """Server health status route."""
    db_connected = False
    try:
        if db.client is not None or db.db is not None:
            db_connected = True
    except Exception:
        db_connected = False

    return {
        "status": "healthy",
        "system": "Trinetra Smart Crime Reporting System Backend",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT,
        "firebase_auth_mock": settings.MOCK_AUTH_ENABLED,
        "database_connected": db_connected,
        "uptime_seconds": round(time.time() - START_TIME, 2),
    }

@app.get("/metrics")
async def get_metrics():
    """System observability and performance metrics endpoint."""
    reports_count = 0
    users_count = 0
    try:
        if db.db is not None:
            if hasattr(db.db.reports, "count_documents"):
                res = db.db.reports.count_documents({})
                reports_count = await res if hasattr(res, "__await__") else res
            if hasattr(db.db.users, "count_documents"):
                res = db.db.users.count_documents({})
                users_count = await res if hasattr(res, "__await__") else res
    except Exception:
        pass

    return {
        "system": "Trinetra",
        "status": "operational",
        "uptime_seconds": round(time.time() - START_TIME, 2),
        "environment": settings.ENVIRONMENT,
        "stats": {
            "total_reports": reports_count,
            "total_registered_users": users_count,
        },
        "services": {
            "database": "connected" if db.db is not None else "disconnected",
            "gemini_ai": "configured" if settings.GEMINI_API_KEY else "disabled",
            "cloudinary": "configured" if settings.CLOUDINARY_API_KEY else "disabled",
            "polygon_blockchain": "active (Polygon Amoy)"
        }
    }

# Wrap FastAPI app inside Socket.IO ASGI application
# Under this configuration, requests to `/socket.io/` are intercepted by python-socketio,
# while all other API calls route to FastAPI.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
