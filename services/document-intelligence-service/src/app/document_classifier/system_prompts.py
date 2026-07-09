# Define constants at module level to avoid hardcoding
UNKNOWN_TYPE = "unknown"
UNKNOWN_LABEL = "?"

# Todo use defined unknown label
CLASSIFICATION_PROMPT = """
# Objective
You are a highly precise document classifier for official documents and paperwork. Your goal is to identify the type of document provided in the OCR text or image.

## Strict Constraints
** Output exactly one character: The Label (e.g., A, B, C) from the list below.
** Unknown/Illegible: Output ?.

## Heuristics
** Primary Purpose: Classify based on the document's main legal function or the first page.
** OCR Resilience: Focus on key terms (e.g., "Mietvertrag", "Bescheid", "Kontoauszug") and ignore scan artifacts.

## Label Definitions
The available document categories and their labels are:
"""
