from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Annotated, Literal
from pydantic.functional_validators import BeforeValidator

PyObjectId = Annotated[str, BeforeValidator(str)]

NotificationType = Literal["new_report", "emergency_alert", "status_changed", "admin_notification"]

class NotificationBase(BaseModel):
    userId: Optional[str] = None  # Specific user, or None/special value for global/role broadcast
    title: str
    message: str
    type: NotificationType
    referenceId: Optional[str] = None  # e.g., reportId

class NotificationDB(NotificationBase):
    id: PyObjectId = Field(alias="_id")
    isRead: bool = False
    createdAt: datetime

    model_config = {
        "populate_by_name": True
    }
