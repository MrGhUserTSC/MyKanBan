from app.security import hash_password, verify_password


def test_hash_is_salted_and_not_plaintext() -> None:
    encoded = hash_password("secret")

    assert "secret" not in encoded
    assert encoded.startswith("pbkdf2_sha256$")
    # A fresh salt each time means identical passwords hash differently.
    assert hash_password("secret") != encoded


def test_verify_accepts_correct_password() -> None:
    encoded = hash_password("correct horse")

    assert verify_password("correct horse", encoded) is True


def test_verify_rejects_wrong_password() -> None:
    encoded = hash_password("correct horse")

    assert verify_password("battery staple", encoded) is False


def test_verify_rejects_malformed_hash() -> None:
    assert verify_password("anything", "not-a-real-hash") is False
    assert verify_password("anything", "") is False
