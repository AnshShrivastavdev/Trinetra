from pydantic import BaseModel, Field
from datetime import datetime
from typing import Annotated
from pydantic.functional_validators import BeforeValidator

PyObjectId = Annotated[str, BeforeValidator(str)]

class VoteBase(BaseModel):
    reportId: str

class VoteDB(VoteBase):
    id: PyObjectId = Field(alias="_id")
    userId: str
    createdAt: datetime

    model_config = {
        "populate_by_name": True
    }
