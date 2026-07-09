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
]
