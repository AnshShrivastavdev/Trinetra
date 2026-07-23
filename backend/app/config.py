import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # Server Configurations
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"

    # MongoDB Configurations
    MONGO_URI: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "trinetra"

    # Firebase Configurations
    FIREBASE_PROJECT_ID: Optional[str] = None
    FIREBASE_CREDENTIALS_PATH: Optional[str] = None

    # External APIs
    GEMINI_API_KEY: Optional[str] = None
    MAPBOX_API_KEY: Optional[str] = None
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None

    # Security & Mocks for Local Testing
    MOCK_AUTH_ENABLED: bool = True
    MOCK_AUTH_SECRET: str = "trinetra_development_secret"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
