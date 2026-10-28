SHOW_CARD_TOOL_NAME = "show_card"

AVAILABLE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_user_table_schema",
            "description": "Returns the database schema for the user-related table. Call this FIRST if you don't know the exact field names to update.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_user_data",
            "description": "Updates the user's data in the database. Use get_user_table_schema first to find valid fields.",
            "parameters": {
                "type": "object",
                "properties": {
                    "updates": {
                        "type": "object",
                        "description": "A dictionary of field names and their new values (e.g. {'rent_total': 550.0}).",
                    },
                },
                "required": ["updates"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_data",
            "description": "Returns all data currently stored about the user, including their address. \
                            **CALL THIS FIRST** when the user asks location-based questions like 'where is my nearest social welfare office?' to check if address information is available.",
            "parameters": {"type": "object", "properties": {}},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_progress_status",
            "description": "Checks the progress of the user's application and returns the completed percentage and missing fields.",
            "parameters": {},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "berlin_social_services_knowledge_base",
            "description": "Search official Berlin social services documentation, including Grundsicherung (basic income support) regulations, eligibility criteria, application processes, \
            and locations of social offices (Sozialämter) in all Berlin districts (Bezirke). Use this for ANY question about social benefits, welfare offices, or district-specific social services in Berlin.",
            "parameters": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                },
                "required": ["question"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": SHOW_CARD_TOOL_NAME,
            "description": "Shows the user the next card of their Grundsicherung application inside the chat, instead of "
            "asking in text. Only for the card the system prompt names as next; it lists the input keys to label.",
            "parameters": {
                "type": "object",
                "properties": {
                    "card_id": {"type": "string", "description": "The card_id the system prompt names"},
                    "question": {"type": "string", "description": "The question, in the language of the conversation"},
                    "hint": {"type": "string", "description": "Optional short explanation below the question"},
                    "labels": {"type": "object", "description": "A short label for each input key"},
                    "option_labels": {
                        "type": "object",
                        "description": "For each choice input key, an object with a label per option value",
                    },
                },
                "required": ["card_id", "question", "labels"],
            },
        },
    },
]
