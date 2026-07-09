from src.db import construct_db_url


def test_construct_db_url_standard():
    url = construct_db_url("devuser", "devpassword", "postgres", "5432", "devdb")
    assert url == "postgresql://devuser:devpassword@postgres:5432/devdb"


def test_construct_db_url_special_characters():
    # Test user and password containing special characters like '@', ':', '/', and '+'
    url = construct_db_url("user@name", "pass@word:123", "10.0.0.5", "5432", "proddb")
    # '@' becomes '%40', ':' becomes '%3A'
    assert url == "postgresql://user%40name:pass%40word%3A123@10.0.0.5:5432/proddb"
