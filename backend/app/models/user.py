from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional, Annotated, Literal
from pydantic.functional_validators import BeforeValidator

PyObjectId = Annotated[str, BeforeValidator(str)]

UserRole = Literal["citizen", "authority", "admin"]

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole

class UserCreate(UserBase):
    firebase_uid: str

class UserResponse(UserBase):
    id: PyObjectId = Field(alias="_id")
    firebase_uid: str
    is_approved: bool
    is_active: bool = True
    createdAt: Optional[datetime] = None

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "60c72b2f9b1d8a236c8b4567",
                "firebase_uid": "some-firebase-uid",
                "email": "user@example.com",
                "name": "Jane Doe",
                "role": "citizen",
                "is_approved": True,
                "createdAt": "2026-07-07T12:00:00Z"
            }
        }
    }
