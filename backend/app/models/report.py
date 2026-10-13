from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Annotated, List, Literal
from pydantic.functional_validators import BeforeValidator

PyObjectId = Annotated[str, BeforeValidator(str)]

ReportStatus = Literal[
    "Pending", "Reported", "FIR Filed", "Ongoing", "Investigating", "Charge-sheet Submitted", "Resolved", "Closed"
]

class LocationSchema(BaseModel):
    lat: float
    lng: float
    address: Optional[str] = None

class GeoJSONPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinates: List[float]  # [longitude, latitude]

class ReportCreate(BaseModel):
    category: str
    description: str
    emergencyFlag: bool = False
    anonymityFlag: bool = False
    whistleblowerMode: bool = False
    mediaUrls: List[str] = Field(default_factory=list)
    evidenceLedger: List[dict] = Field(default_factory=list)
    assignedDepartment: Optional[str] = None
    location: LocationSchema

class ReportResponse(BaseModel):
    id: PyObjectId = Field(alias="_id")
    category: str
    description: str
    emergencyFlag: bool
    anonymityFlag: bool
    whistleblowerMode: bool = False
    whistleblowerToken: Optional[str] = None
    mediaUrls: List[str] = Field(default_factory=list)
    evidenceLedger: List[dict] = Field(default_factory=list)
    auditTrail: List[dict] = Field(default_factory=list)
    firNumber: Optional[str] = None
    firDetails: Optional[dict] = None
    assignedDepartment: Optional[str] = None
    location: LocationSchema
    status: ReportStatus
    voteCount: int = 0
    isFlagged: bool = False
    createdBy: str  # "anonymous" or user name
    createdAt: datetime
    updatedAt: datetime
    aiAnalysis: Optional[dict] = None

    model_config = {
        "populate_by_name": True,
        "json_schema_extra": {
            "example": {
                "_id": "60c72b2f9b1d8a236c8b4568",
                "category": "Theft",
                "description": "Stolen bicycle near the park entry.",
                "emergencyFlag": False,
                "anonymityFlag": True,
                "whistleblowerMode": False,
                "mediaUrls": ["https://cloudinary.com/example.jpg"],
                "evidenceLedger": [],
                "auditTrail": [],
                "firNumber": "FIR-2026-1013-A8F2",
                "assignedDepartment": "Local Police",
                "location": {
                    "lat": 12.9716,
                    "lng": 77.5946,
                    "address": "Cubbon Park, Bangalore"
                },
                "status": "FIR Filed",
                "voteCount": 5,
                "isFlagged": False,
                "createdBy": "anonymous",
                "createdAt": "2026-07-07T12:00:00Z",
                "updatedAt": "2026-07-07T12:05:00Z",
                "aiAnalysis": None
            }
        }
    }
