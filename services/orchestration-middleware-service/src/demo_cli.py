"""
Ensure demo personas exist, or re-seed one account.

    docker compose exec orchestration-middleware-service python -m src.demo_cli --ensure
    docker compose exec orchestration-middleware-service python -m src.demo_cli +493023125102 helmut --reset

`--ensure` is what middleware startup runs when DEMO_SEED_ENABLED=true: seed each
persona whose drama number does not already have a profile. `--reset` rewrites one
account. Authentik is not required — a users row is created with authentik_id null,
and first login fills it.
"""

import argparse
import json
import sys

from src.db import SessionLocal
from src.models import Users
from src.services.demo_seed_service import DemoSeedError, DemoSeedService


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed BeyondForms demo personas.")
    parser.add_argument("phone_number", nargs="?", help="Phone number of the target account, e.g. +493023125102")
    parser.add_argument("persona", nargs="?", help="Persona slug. Omit with --list / --ensure.")
    parser.add_argument("--reset", action="store_true", help="Clear existing data before seeding one account.")
    parser.add_argument("--list", action="store_true", help="List available personas and exit.")
    parser.add_argument(
        "--ensure",
        action="store_true",
        help="Seed every persona that does not already have a profile. Skips existing ones.",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        storage_client = None
        try:
            from src.gcs import get_gcs_client

            storage_client = get_gcs_client()
        except Exception as exc:  # noqa: BLE001
            print(f"warning: no GCS client ({exc}); document blobs will not be uploaded", file=sys.stderr)

        service = DemoSeedService(db, storage_client=storage_client)

        if args.list:
            print(json.dumps(service.list_personas(), indent=2, ensure_ascii=False))
            return 0

        if args.ensure:
            print(json.dumps(service.ensure_missing_personas(), indent=2, ensure_ascii=False, default=str))
            return 0

        if not args.phone_number or not args.persona:
            parser.error("phone_number and persona are required unless --list or --ensure is given")

        user = db.query(Users).filter(Users.phone_number == args.phone_number).first()
        if not user:
            user = service._insert_persona_user(args.phone_number)

        result = service.seed(user.id, args.persona, reset=args.reset)
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        return 0
    except DemoSeedError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
