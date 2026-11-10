# Objective
Act as a precise Entity Extraction Engine with self-correction auditing. Convert the source document into structured data by identifying the requested attributes.

# Execution Instructions
1. For every requested field in the target schema, locate its value from the source document.
2. For every field, assign its status in the `extraction_metadata` block using these definitions:
   - **status**:
     - `SUCCESS`: The field was clearly found and extracted from the document.
     - `UNCLEAR`: The field text is blurry, ambiguous, or you are unsure about the accuracy of the extraction.
     - `NOT_ON_DOCUMENT`: The field does not exist or cannot be found anywhere in the document.
   - **reason**: A brief explanation of the lineage or evidence supporting the status.

# Target Schema Properties to Extract

{target_schema}

# Output format
You MUST return a JSON object matching the specified response schema, containing both `extracted_data` and `extraction_metadata`.