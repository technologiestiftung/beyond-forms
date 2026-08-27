import uuid
from unittest.mock import MagicMock
from src.models import UserDocuments, UploadedFiles, DocumentStatusType, UserApplications
from src.services.user_service import UserService


def test_cleanup_missing_gcs_files():
    db = MagicMock()
    user_id = uuid.uuid4()
    file_id = uuid.uuid4()
    doc_id = uuid.uuid4()

    mock_doc = UserDocuments(
        document_id=doc_id,
        fk_user_id=user_id,
        fk_file_id=file_id,
        status=DocumentStatusType.VERIFIED,
    )
    mock_file = UploadedFiles(
        id=file_id,
        name="test.pdf",
        bucket_name="staging-bucket",
        object_name="missing_blob",
    )

    query_mock = db.query.return_value
    outerjoin_mock = query_mock.outerjoin.return_value
    filter_mock = outerjoin_mock.filter.return_value
    filter_mock.all.return_value = [(mock_doc, mock_file)]

    mock_client = MagicMock()
    mock_bucket = MagicMock()
    mock_client.bucket.return_value = mock_bucket
    mock_blob = MagicMock()
    mock_bucket.blob.return_value = mock_blob
    mock_blob.exists.return_value = False

    user_service = UserService(db, storage_client=mock_client)
    user_service.cleanup_missing_gcs_files(user_id)

    assert mock_doc.status == DocumentStatusType.FAILED
    assert mock_doc.user_error_code == "GCS_BLOB_MISSING"
    assert mock_doc.internal_error_log is not None
    assert "scrubbed by storage TTL policy" in mock_doc.internal_error_log
    db.commit.assert_called_once()


def test_get_or_create_user_application_reuses_matching_form_type():
    db = MagicMock()
    user_id = uuid.uuid4()
    existing = UserApplications(
        application_id=uuid.uuid4(),
        fk_user_id=user_id,
        form_type="antrag_wohngeld",
        status="in_progress",
        form_data={},
    )
    db.query.return_value.filter.return_value.first.return_value = existing

    _, application_id = UserService(db).get_or_create_user_application(user_id, "antrag_wohngeld")

    assert application_id == existing.application_id
    db.add.assert_not_called()


def test_get_or_create_user_application_creates_with_the_requested_form_type():
    db = MagicMock()
    user_id = uuid.uuid4()
    db.query.return_value.filter.return_value.first.return_value = None

    _, application_id = UserService(db).get_or_create_user_application(user_id, "antrag_grundsicherung")

    db.add.assert_called_once()
    created = db.add.call_args.args[0]
    assert isinstance(created, UserApplications)
    assert created.fk_user_id == user_id
    assert created.form_type == "antrag_grundsicherung"
    assert created.application_id == application_id
    db.flush.assert_called_once()
