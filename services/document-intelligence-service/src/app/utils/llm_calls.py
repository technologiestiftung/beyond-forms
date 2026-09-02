import math
import os


def get_number_of_retries() -> int:
    try:
        return int(os.getenv("LLM_RETRIES", "3"))
    except ValueError:
        return 3
