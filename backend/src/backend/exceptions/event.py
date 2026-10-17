class NotFoundError(Exception):
    pass


class PermissionDeniedError(Exception):
    pass


class InvalidStateError(Exception):
    """The action is not allowed in the current event state."""

    def __init__(self, message: str, leaders: list[int] | None = None):
        super().__init__(message)
        # Tied date option ids when closing a vote needs a creator decision.
        self.leaders = leaders or []
