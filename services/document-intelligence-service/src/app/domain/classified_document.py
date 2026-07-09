from typing import Optional

from openai import BaseModel


class ClassifiedDocument(BaseModel):
    document_type: str
    system_label: str
    confidence: float

    candidate_rankings: Optional[list] = None
