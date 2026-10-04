from pwdlib import PasswordHash
from backend.core.config import get_logger

log = get_logger(__name__)

password_hash = PasswordHash.recommended()


def verify_password(plain_password, hashed_password):
    # log.warning(
    #     "plain pass: %s, hashed_password: %s",
    #     plain_password,
    #     hashed_password,
    # )
    return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password):
    return password_hash.hash(password)
