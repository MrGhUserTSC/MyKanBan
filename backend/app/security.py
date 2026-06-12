from __future__ import annotations

import hashlib
import hmac
from secrets import token_bytes

PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 200_000
SALT_BYTES = 16


def hash_password(password: str) -> str:
    salt = token_bytes(SALT_BYTES)
    derived = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"pbkdf2_{PBKDF2_ALGORITHM}${PBKDF2_ITERATIONS}${salt.hex()}${derived.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        scheme, iterations, salt_hex, hash_hex = encoded.split("$")
        algorithm = scheme.removeprefix("pbkdf2_")
        derived = hashlib.pbkdf2_hmac(
            algorithm,
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iterations),
        )
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(derived.hex(), hash_hex)
