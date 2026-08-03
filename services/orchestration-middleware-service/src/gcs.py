import logging
import os

from google.cloud import storage

logger = logging.getLogger(__name__)

_gcs_client = None


def get_gcs_client():
    global _gcs_client
    if _gcs_client is None:
        # google-cloud-storage reads STORAGE_EMULATOR_HOST itself and switches to
        # anonymous credentials, so no Google credentials are needed against an emulator.
        _gcs_client = storage.Client()
    return _gcs_client


def ensure_emulator_bucket() -> None:
    """
    Create the configured bucket when pointed at a GCS emulator.

    No-op against real GCS. The emulator starts with no buckets, so every upload would
    404 until something creates one.
    """
    emulator_host = os.environ.get("STORAGE_EMULATOR_HOST")
    if not emulator_host:
        return

    bucket_name = os.environ.get("GCS_BUCKET_NAME", "beyondforms-dev-bucket")
    try:
        client = get_gcs_client()
        if client.lookup_bucket(bucket_name) is None:
            client.create_bucket(bucket_name)
            logger.info("Created bucket %s on GCS emulator %s", bucket_name, emulator_host)
    except Exception as e:
        logger.warning("Could not prepare bucket %s on GCS emulator %s: %s", bucket_name, emulator_host, e)
