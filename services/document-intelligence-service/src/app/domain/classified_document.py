from typing import Optional

from openai import BaseModel


class ClassifiedDocument(BaseModel):
    document_type: str
    system_label: str

    candidate_rankings: Optional[list] = None
