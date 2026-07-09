import pytest
from unittest.mock import patch

from src.services.rag_service import _resolve_store_id, search_knowledge_base, GEMINI_PROVIDER


class TestResolveStoreId:
    @patch("os.getenv")
    def test_resolve_store_id_success(self, mock_getenv):
        def mock_env(key):
            return {
                "RAG_ENGINE_CORPUS": "test-corpus",
                "GCLOUD_PROJECT": "test-project",
                "GCP_RAG_ENGINE_REGION": "test-region",
            }.get(key)

        mock_getenv.side_effect = mock_env

        store_id, project, location = _resolve_store_id()
        assert store_id == "projects/test-project/locations/test-region/ragCorpora/test-corpus"
        assert project == "test-project"
        assert location == "test-region"

    @patch("os.getenv")
    def test_resolve_store_id_missing_corpus(self, mock_getenv):
        def mock_env(key):
            return {"GCLOUD_PROJECT": "test-project", "GCP_RAG_ENGINE_REGION": "test-region"}.get(key)

        mock_getenv.side_effect = mock_env

        with pytest.raises(ValueError, match="RAG_ENGINE_CORPUS must be set"):
            _resolve_store_id()

    @patch("os.getenv")
    def test_resolve_store_id_missing_project(self, mock_getenv):
        def mock_env(key):
            return {"RAG_ENGINE_CORPUS": "test-corpus", "GCP_RAG_ENGINE_REGION": "test-region"}.get(key)

        mock_getenv.side_effect = mock_env

        with pytest.raises(ValueError, match="GCLOUD_PROJECT must be set"):
            _resolve_store_id()

    @patch("os.getenv")
    def test_resolve_store_id_missing_location(self, mock_getenv):
        def mock_env(key):
            return {
                "RAG_ENGINE_CORPUS": "test-corpus",
                "GCLOUD_PROJECT": "test-project",
            }.get(key)

        mock_getenv.side_effect = mock_env

        with pytest.raises(ValueError, match="GCP_RAG_ENGINE_REGION must be set"):
            _resolve_store_id()


class TestSearchKnowledgeBase:
    @pytest.mark.asyncio
    @patch("src.services.rag_service._resolve_store_id")
    @patch("src.services.rag_service.asearch")
    async def test_search_knowledge_base_success_dict(self, mock_asearch, mock_resolve_store_id):
        mock_resolve_store_id.return_value = ("test-store-id", "test-project", "test-location")

        mock_asearch.return_value = {
            "data": [
                {"content": [{"text": "First relevant chunk."}]},
                {"content": [{"text": "Second relevant chunk."}]},
            ]
        }

        result = await search_knowledge_base("test question")

        assert result == "First relevant chunk.\n\n---\n\nSecond relevant chunk."
        mock_asearch.assert_called_once_with(
            vector_store_id="test-store-id",
            query="test question",
            custom_llm_provider=GEMINI_PROVIDER,
            max_num_results=5,
            vertex_project="test-project",
            vertex_location="test-location",
        )

    @pytest.mark.asyncio
    @patch("src.services.rag_service._resolve_store_id")
    @patch("src.services.rag_service.asearch")
    async def test_search_knowledge_base_success_object(self, mock_asearch, mock_resolve_store_id):
        mock_resolve_store_id.return_value = ("test-store-id", "test-project", "test-location")

        class MockContent:
            def __init__(self, text):
                self.text = text

        class MockItem:
            def __init__(self, text):
                self.content = [MockContent(text)]

        class MockResponse:
            def __init__(self):
                self.data = [MockItem("Object chunk 1."), MockItem("Object chunk 2.")]

        mock_asearch.return_value = MockResponse()

        result = await search_knowledge_base("test question")

        assert result == "Object chunk 1.\n\n---\n\nObject chunk 2."

    @pytest.mark.asyncio
    @patch("src.services.rag_service._resolve_store_id")
    async def test_search_knowledge_base_not_configured(self, mock_resolve_store_id):
        mock_resolve_store_id.return_value = None

        result = await search_knowledge_base("test question")

        assert result == "Knowledge base not configured."

    @pytest.mark.asyncio
    @patch("src.services.rag_service._resolve_store_id")
    @patch("src.services.rag_service.asearch")
    async def test_search_knowledge_base_no_response(self, mock_asearch, mock_resolve_store_id):
        mock_resolve_store_id.return_value = ("test-store-id", "test-project", "test-location")
        mock_asearch.return_value = None

        result = await search_knowledge_base("test question")

        assert result == "No relevant information found."

    @pytest.mark.asyncio
    @patch("src.services.rag_service._resolve_store_id")
    @patch("src.services.rag_service.asearch")
    async def test_search_knowledge_base_no_data(self, mock_asearch, mock_resolve_store_id):
        mock_resolve_store_id.return_value = ("test-store-id", "test-project", "test-location")
        mock_asearch.return_value = {"data": []}

        result = await search_knowledge_base("test question")

        assert result == "No relevant information found."

    @pytest.mark.asyncio
    @patch("src.services.rag_service._resolve_store_id")
    @patch("src.services.rag_service.asearch")
    async def test_search_knowledge_base_empty_content(self, mock_asearch, mock_resolve_store_id):
        mock_resolve_store_id.return_value = ("test-store-id", "test-project", "test-location")
        mock_asearch.return_value = {
            "data": [{"content": []}, {"content": [{"text": ""}]}, {"content": [{"other": "field"}]}]
        }

        result = await search_knowledge_base("test question")

        assert result == "No relevant information found."
