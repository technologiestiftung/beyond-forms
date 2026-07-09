import json
import logging
import os

from google.api_core.exceptions import AlreadyExists
from google.cloud import pubsub_v1
from sqlalchemy.types import UUID

logger = logging.getLogger(__name__)

PROJECT_ID = os.environ.get("PUBSUB_PROJECT_ID", "beyondforms-dev")
TOPIC_ID = os.environ.get("PUBSUB_TOPIC_ID", "document-processing")
SUBSCRIPTION_ID = os.environ.get("PUBSUB_SUBSCRIPTION_ID", "document-processing-sub")
DLQ_TOPIC_ID = os.environ.get("PUBSUB_DLQ_TOPIC_ID", "document-processing-dlq")

# Check if we are running with emulator
EMULATOR_HOST = os.environ.get("PUBSUB_EMULATOR_HOST")
if EMULATOR_HOST:
    logger.info(f"Using Pub/Sub Emulator at {EMULATOR_HOST}")


def get_publisher_client():
    return pubsub_v1.PublisherClient()


def get_subscriber_client():
    return pubsub_v1.SubscriberClient()


def initialize_pubsub():
    """
    Creates topics and subscriptions if running in emulator environment.
    Gated to prevent conflicts in production/staging.
    """
    if not EMULATOR_HOST:
        logger.info("Not running in emulator environment. Skipping programmatic Pub/Sub initialization.")
        return

    publisher = get_publisher_client()
    subscriber = get_subscriber_client()

    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)
    dlq_topic_path = publisher.topic_path(PROJECT_ID, DLQ_TOPIC_ID)
    sub_path = subscriber.subscription_path(PROJECT_ID, SUBSCRIPTION_ID)

    # Create Topics
    for t_path in [topic_path, dlq_topic_path]:
        try:
            publisher.create_topic(request={"name": t_path})
            logger.info(f"Created Pub/Sub topic: {t_path}")
        except AlreadyExists:
            logger.info(f"Pub/Sub topic already exists: {t_path}")
        except Exception as e:
            logger.error(f"Failed to create topic {t_path}: {e}")

    # Create Subscription with DLQ
    try:
        subscriber.create_subscription(
            request={
                "name": sub_path,
                "topic": topic_path,
                "dead_letter_policy": {"dead_letter_topic": dlq_topic_path, "max_delivery_attempts": 5},
            }
        )
        logger.info(f"Created Pub/Sub subscription: {sub_path}")
    except AlreadyExists:
        logger.info(f"Pub/Sub subscription already exists: {sub_path}")
    except Exception as e:
        logger.error(f"Failed to create subscription {sub_path}: {e}")


def publish_document_event(document_id: UUID, gcs_uri: str):
    """
    Publishes a message to the document processing topic.
    """
    publisher = get_publisher_client()
    topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

    data = {"document_id": str(document_id), "gcs_uri": gcs_uri}

    message_bytes = json.dumps(data).encode("utf-8")

    try:
        future = publisher.publish(topic_path, message_bytes)
        message_id = future.result()
        logger.info(f"Published message {message_id} to {topic_path}")
        return message_id
    except Exception as e:
        logger.error(f"Failed to publish message to Pub/Sub: {e}")
        raise
