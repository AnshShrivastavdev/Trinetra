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

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(admin.router)

@app.get("/")
async def health_check():
    """Server health status route."""
    return {
        "status": "healthy",
        "system": "Trinetra Smart Crime Reporting System Backend",
        "environment": settings.ENVIRONMENT,
        "firebase_auth_mock": settings.MOCK_AUTH_ENABLED
    }

# Wrap FastAPI app inside Socket.IO ASGI application
# Under this configuration, requests to `/socket.io/` are intercepted by python-socketio,
# while all other API calls route to FastAPI.
socket_app = socketio.ASGIApp(sio, other_asgi_app=app)
