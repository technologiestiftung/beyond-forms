import os

# Set default environment variables for testing before imports occur
os.environ["GEMINI_MODEL_NAME"] = os.environ.get("GEMINI_MODEL_NAME", "gemini-3.7-flash")
os.environ["GCLOUD_PROJECT"] = os.environ.get("GCLOUD_PROJECT", "beyond-forms-staging")
os.environ["CHAT_CONTEXT_WINDOW_SIZE"] = os.environ.get("CHAT_CONTEXT_WINDOW_SIZE", "20")
os.environ["ENDPOINT_RULES_ENGINE"] = os.environ.get("ENDPOINT_RULES_ENGINE", "http://rules-engine:8080")
os.environ["ENDPOINT_FORMS_FILLER"] = os.environ.get("ENDPOINT_FORMS_FILLER", "http://forms-filling-service:8080")
os.environ["AUTHENTIK_PUBLIC_KEY_PATH"] = os.environ.get("AUTHENTIK_PUBLIC_KEY_PATH", "")
os.environ["DEMO_SEED_ENABLED"] = "false"
