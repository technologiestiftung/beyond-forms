import asyncio
import os
import tempfile
import shutil
import pytest
from unittest.mock import patch, MagicMock
from src.services.form_service import FormAssetCacheManager


@pytest.fixture
def temp_assets_dir():
    # Create temporary directories for mapping and pdf
    temp_dir = tempfile.mkdtemp()
    mapping_dir = os.path.join(temp_dir, "mappings")
    pdf_dir = os.path.join(temp_dir, "pdfs")
    os.makedirs(mapping_dir)
    os.makedirs(pdf_dir)

    yield mapping_dir, pdf_dir

    # Cleanup
    shutil.rmtree(temp_dir)


@pytest.mark.asyncio
async def test_cache_hit_miss_and_clear(temp_assets_dir):
    mapping_dir, pdf_dir = temp_assets_dir
    form_name = "testform"

    # Create dummy mapping and PDF files
    mapping_path = os.path.join(mapping_dir, f"{form_name}.toml")
    pdf_path = os.path.join(pdf_dir, f"{form_name}.pdf")

    with open(mapping_path, "w") as f:
        f.write('p1_field = "value"\n[p2_field]\ntype = "checkbox"\nvalue = true\n')

    with open(pdf_path, "wb") as f:
        f.write(b"%PDF-1.4 mock bytes")

    # Initialize cache manager
    cache_manager = FormAssetCacheManager()

    # First load: Cache MISS
    mapping1, field_types1, pdf_bytes1 = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)
    assert mapping1["p1_field"] == "value"
    assert field_types1["p2_field"] == "checkbox"
    assert pdf_bytes1.startswith(b"%PDF")

    # Second load (immediate): Cache HIT (served as deep copies of dicts, zero copy for immutable bytes)
    with patch.object(cache_manager, "_load_assets_from_disk", wraps=cache_manager._load_assets_from_disk) as mock_disk:
        mapping2, field_types2, pdf_bytes2 = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)
        assert mapping2 == mapping1
        assert mapping2 is not mapping1  # Dictionaries must be distinct instances
        assert field_types2 == field_types1
        assert field_types2 is not field_types1  # Dictionaries must be distinct instances
        assert pdf_bytes2 is pdf_bytes1  # Bytes are immutable, can safely remain zero-copy reference
        mock_disk.assert_not_called()

    # Clear cache
    cache_manager.clear()

    # Third load (after clear): Cache MISS again
    with patch.object(cache_manager, "_load_assets_from_disk", wraps=cache_manager._load_assets_from_disk) as mock_disk:
        mapping3, field_types3, pdf_bytes3 = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)
        assert mapping3 == mapping1
        assert mapping3 is not mapping1  # Different reference now
        mock_disk.assert_called_once()


@pytest.mark.asyncio
async def test_cache_deep_copy_prevents_contamination(temp_assets_dir):
    mapping_dir, pdf_dir = temp_assets_dir
    form_name = "nestedform"

    mapping_path = os.path.join(mapping_dir, f"{form_name}.toml")
    pdf_path = os.path.join(pdf_dir, f"{form_name}.pdf")

    with open(mapping_path, "w") as f:
        f.write('title = "Application"\n[options]\ntype = "choice"\nvalue = { list_vals = ["A", "B", "C"] }\n')
    with open(pdf_path, "wb") as f:
        f.write(b"%PDF")

    cache_manager = FormAssetCacheManager()

    # Get assets
    mapping1, field_types1, pdf_bytes1 = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)
    assert mapping1["options"]["list_vals"] == ["A", "B", "C"]

    # Mutate returned mapping dictionary
    mapping1["title"] = "Contaminated Title"
    mapping1["options"]["list_vals"].append("D")

    # Query cache again
    mapping2, field_types2, pdf_bytes2 = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)

    # Verify cache was NOT contaminated
    assert mapping2["title"] == "Application"
    assert mapping2["options"]["list_vals"] == ["A", "B", "C"]
    assert mapping2 is not mapping1
    assert pdf_bytes2 is pdf_bytes1  # Bytes remain zero-copy


@pytest.mark.asyncio
async def test_cache_stampede_coalescing(temp_assets_dir):
    mapping_dir, pdf_dir = temp_assets_dir
    form_name = "stampede"

    mapping_path = os.path.join(mapping_dir, f"{form_name}.toml")
    pdf_path = os.path.join(pdf_dir, f"{form_name}.pdf")

    with open(mapping_path, "w") as f:
        f.write('field = "yes"')
    with open(pdf_path, "wb") as f:
        f.write(b"%PDF")

    cache_manager = FormAssetCacheManager(ttl_seconds=5.0)

    # Mock the disk load method to introduce an artificial async delay
    original_load = cache_manager._load_assets_from_disk
    call_counter = 0

    async def delayed_load(*args, **kwargs):
        nonlocal call_counter
        call_counter += 1
        await asyncio.sleep(0.2)  # delay
        return await original_load(*args, **kwargs)

    with patch.object(cache_manager, "_load_assets_from_disk", side_effect=delayed_load) as mock_loader:
        # Spawn 20 parallel cache requests at the exact same time
        tasks = [cache_manager.get_assets(form_name, mapping_dir, pdf_dir) for _ in range(20)]
        results = await asyncio.gather(*tasks)

        # Assert all 20 tasks got the identical correct data
        for mapping, field_types, pdf_bytes in results:
            assert mapping["field"] == "yes"

        # The physical disk loader MUST have been invoked EXACTLY once
        assert call_counter == 1
        mock_loader.assert_called_once()


@pytest.mark.asyncio
async def test_cancellation_and_error_resilience(temp_assets_dir):
    mapping_dir, pdf_dir = temp_assets_dir
    form_name = "failform"
    mapping_path = os.path.join(mapping_dir, f"{form_name}.toml")
    pdf_path = os.path.join(pdf_dir, f"{form_name}.pdf")

    with open(mapping_path, "w") as f:
        f.write('field = "ok"')
    with open(pdf_path, "wb") as f:
        f.write(b"%PDF")

    cache_manager = FormAssetCacheManager(ttl_seconds=5.0)

    # Test 1: Loader raises an exception
    class MockFailingFile:
        async def __aenter__(self):
            await asyncio.sleep(0.1)
            raise IOError("Disk read failure simulation")

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

    with patch("src.services.form_service.aiofiles.open", return_value=MockFailingFile()):
        with pytest.raises(IOError, match="Disk read failure simulation"):
            await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)

        # Verify that the failed task has been automatically popped from inflight index
        assert form_name not in cache_manager._inflight_tasks

    # Test 2: Task is cancelled
    class MockSlowFile:
        async def __aenter__(self):
            await asyncio.sleep(5.0)
            return self

        async def __aexit__(self, exc_type, exc_val, exc_tb):
            pass

        async def read(self):
            return b"field = 'ok'"

    with patch("src.services.form_service.aiofiles.open", return_value=MockSlowFile()):
        # Trigger loading
        task = asyncio.create_task(cache_manager.get_assets(form_name, mapping_dir, pdf_dir))
        await asyncio.sleep(0.1)

        # Cancel the request
        task.cancel()

        with pytest.raises(asyncio.CancelledError):
            await task

        # Verify that the background loader task is still running (shielded from caller cancellation)
        assert form_name in cache_manager._inflight_tasks

        # Now cancel the underlying background task directly
        bg_task = cache_manager._inflight_tasks[form_name]
        bg_task.cancel()

        # Wait for background task cancellation to propagate
        try:
            await bg_task
        except asyncio.CancelledError:
            pass

        # Verify that the task is now cleanly popped from the inflight index
        assert form_name not in cache_manager._inflight_tasks

    # Verify we can fetch assets successfully now (it retries load since it was popped)
    mapping, _, _ = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)
    assert mapping["field"] == "ok"


@pytest.mark.asyncio
async def test_path_traversal_security_whitelists(temp_assets_dir):
    mapping_dir, pdf_dir = temp_assets_dir
    cache_manager = FormAssetCacheManager()

    # Traversal payload 1: Relative traversal paths
    with pytest.raises(ValueError, match="Invalid form name"):
        await cache_manager.get_assets("../../../secrets", mapping_dir, pdf_dir)

    # Traversal payload 2: Characters outside whitelist
    with pytest.raises(ValueError, match="Invalid form name"):
        await cache_manager.get_assets("form;rm -rf", mapping_dir, pdf_dir)

    # Traversal payload 3: Form name pattern is alphanumeric, but we attempt outside folder containment
    mock_pattern = MagicMock()
    mock_pattern.match.return_value = True
    with patch("src.services.form_service.FORM_NAME_PATTERN", mock_pattern):
        with pytest.raises(PermissionError, match="Access Denied: Path traversal blocked"):
            # Try to trick it by putting directory paths in form_name that resolve outside mappings folder
            await cache_manager.get_assets("/etc/passwd", mapping_dir, pdf_dir)

    # Traversal payload 4: Folder prefix bypass (e.g. accessing a parallel mappings_secret folder)
    mock_pattern = MagicMock()
    mock_pattern.match.return_value = True
    with patch("src.services.form_service.FORM_NAME_PATTERN", mock_pattern):
        # Target: "/app/forms/mappings_secret/secret_form.toml"
        # Base directory: "/app/forms/mappings"
        # If we check "/app/forms/mappings_secret/secret_form.toml".startswith("/app/forms/mappings"),
        # it will return True without trailing os.sep checks.
        # With our trailing os.sep fix, it will evaluate "/app/forms/mappings/" and evaluate to False!
        with pytest.raises(PermissionError, match="Access Denied: Path traversal blocked"):
            await cache_manager.get_assets("../mappings_secret/secret_form", "/app/forms/mappings", "/app/forms/pdfs")

    # Traversal payload 5: Symbolic link outside boundary traversal
    outside_dir = os.path.join(os.path.dirname(mapping_dir), "outside_secrets")
    os.makedirs(outside_dir, exist_ok=True)
    secret_file = os.path.join(outside_dir, "confidential.toml")
    with open(secret_file, "w") as f:
        f.write("key = 'secret'")

    symlinked_form_name = "symlinkform"
    symlink_path = os.path.join(mapping_dir, f"{symlinked_form_name}.toml")
    if not os.path.exists(symlink_path):
        os.symlink(secret_file, symlink_path)

    mock_pattern = MagicMock()
    mock_pattern.match.return_value = True
    with patch("src.services.form_service.FORM_NAME_PATTERN", mock_pattern):
        with pytest.raises(PermissionError, match="Access Denied: Path traversal blocked"):
            await cache_manager.get_assets(symlinked_form_name, mapping_dir, pdf_dir)


@pytest.mark.asyncio
async def test_cache_infinite_ttl(temp_assets_dir):
    mapping_dir, pdf_dir = temp_assets_dir
    form_name = "infinitetest"

    mapping_path = os.path.join(mapping_dir, f"{form_name}.toml")
    pdf_path = os.path.join(pdf_dir, f"{form_name}.pdf")

    with open(mapping_path, "w") as f:
        f.write('field = "forever"')
    with open(pdf_path, "wb") as f:
        f.write(b"%PDF")

    # Initialize cache manager with default (None / infinite TTL)
    cache_manager = FormAssetCacheManager()
    assert cache_manager.ttl_seconds is None

    # Load: Cache MISS
    mapping1, _, _ = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)
    assert mapping1["field"] == "forever"

    # Verify that a second request returns a cache hit even if time passed
    with patch.object(cache_manager, "_load_assets_from_disk") as mock_disk:
        mapping2, _, _ = await cache_manager.get_assets(form_name, mapping_dir, pdf_dir)
        assert mapping2["field"] == "forever"
        mock_disk.assert_not_called()
