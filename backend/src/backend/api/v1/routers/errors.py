from fastapi.exceptions import HTTPException
from starlette.status import (
    HTTP_403_FORBIDDEN,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
)

from backend.exceptions import InvalidStateError, NotFoundError, PermissionDeniedError

DOMAIN_ERRORS = (NotFoundError, PermissionDeniedError, InvalidStateError)


def to_http_error(ex: Exception) -> HTTPException:
    """Translate a domain error raised by services into an HTTPException."""
    if isinstance(ex, NotFoundError):
        return HTTPException(status_code=HTTP_404_NOT_FOUND, detail=str(ex))
    if isinstance(ex, PermissionDeniedError):
        return HTTPException(status_code=HTTP_403_FORBIDDEN, detail=str(ex))
    if isinstance(ex, InvalidStateError):
        detail: str | dict = str(ex)
        if ex.leaders:
            detail = {"message": str(ex), "leaders": ex.leaders}
        return HTTPException(status_code=HTTP_409_CONFLICT, detail=detail)
    raise ex
