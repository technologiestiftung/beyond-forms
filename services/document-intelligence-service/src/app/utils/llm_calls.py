import math
import os


def get_number_of_retries() -> int:
    try:
        return int(os.getenv("LLM_RETRIES", "3"))
    except ValueError:
        return 3


def log_probability_to_confidence(log_probability: float) -> float:
    """Converts the top-token log probability into a linear percentage score."""
    return math.exp(log_probability)
