import json
from pathlib import Path

import json5


def load_json(path: Path) -> object:
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() in (".jsonc", ".json5"):
        return json5.loads(text)
    return json.loads(text)
