"""
Seed a demo persona from inside the container, without going through HTTP or Authentik.

    docker compose exec orchestration-middleware-service \
        python -m src.demo_cli +493023125102 helmut --reset

Useful when Authentik is not running locally, or when you want to re-seed without
minting a token. The account must already exist — `auth-service.get_or_create_user`
creates the `users` row on first login, and this tool deliberately will not.

For staging, use the HTTP endpoint instead: AlloyDB has a private IP and is only
reachable from inside the VPC.
"""

import argparse
import json
import sys

from src.db import SessionLocal
from src.models import Users
from src.services.demo_seed_service import DemoSeedError, DemoSeedService


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed a BeyondForms demo persona onto a test account.")
    parser.add_argument("phone_number", help="Phone number of the target account, e.g. +493023125102")
    parser.add_argument("persona", nargs="?", help="Persona slug. Omit with --list to just enumerate them.")
    parser.add_argument("--reset", action="store_true", help="Clear existing data before seeding.")
    parser.add_argument("--list", action="store_true", help="List available personas and exit.")
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
        if not args.persona:
            parser.error("persona is required unless --list is given")

        user = db.query(Users).filter(Users.phone_number == args.phone_number).first()
        if not user:
            print(
                f"error: no users row for {args.phone_number}. Log in once via auth-service first "
                "so get_or_create_user creates it.",
                file=sys.stderr,
            )
            return 1

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
