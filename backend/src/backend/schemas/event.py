import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from backend.core.timeutils import UtcInput, UtcOutput, utcnow


def _clean_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("name must not be empty")
    return value


def _clean_description(value: str | None) -> str | None:
    if value is None:
        return None
    return value.strip() or None


def _clean_logins(value: list[str]) -> list[str]:
    # Accept "@login" too, drop blanks and duplicates, keep order.
    cleaned: list[str] = []
    for login in value:
        login = login.strip().removeprefix("@").strip()
        if login and login not in cleaned:
            cleaned.append(login)
    return cleaned


def _future(value: datetime.datetime) -> datetime.datetime:
    if value <= utcnow():
        raise ValueError("must be in the future")
    return value


class EventInputSchema(BaseModel):
    name: str = Field(max_length=128)
    online: bool = False
    deadline: UtcInput
    description: str | None = Field(default=None, max_length=1024)
    invite_logins: list[str] = []

    _name = field_validator("name")(_clean_name)
    _description = field_validator("description")(_clean_description)
    _logins = field_validator("invite_logins")(_clean_logins)
    _deadline = field_validator("deadline")(_future)


class EventUpdateSchema(BaseModel):
    """Partial update: only the fields that are sent are changed."""

    name: str | None = Field(default=None, max_length=128)
    online: bool | None = None
    deadline: UtcInput | None = None
    description: str | None = Field(default=None, max_length=1024)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return None if value is None else _clean_name(value)

    _description = field_validator("description")(_clean_description)

    @field_validator("deadline")
    @classmethod
    def _deadline(cls, value: datetime.datetime | None) -> datetime.datetime | None:
        return None if value is None else _future(value)


class EventOutputSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    online: bool
    deadline: UtcOutput
    description: str | None = None
    status: str = "collecting"
    creator_id: int | None = None
    final_start: UtcOutput | None = None
    final_end: UtcOutput | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _status(cls, value):
        # EventStatus enum -> its value, e.g. "voting".
        return getattr(value, "value", value)


class EventMemberOutputSchema(BaseModel):
    user_id: int
    login: str
    status: str  # "invited" | "joined"


class EventDetailSchema(EventOutputSchema):
    creator_login: str
    members: list[EventMemberOutputSchema]
    # Status of the current user in this event: "creator" | "joined" | "invited".
    my_status: str
    # True when the deadline passed with a tie and the creator has to pick the winner.
    awaiting_creator: bool = False


class InviteSchema(BaseModel):
    logins: list[str] = Field(min_length=1)

    _logins = field_validator("logins")(_clean_logins)


class DateOptionInputSchema(BaseModel):
    start: UtcInput
    end: UtcInput

    _start = field_validator("start")(_future)

    @model_validator(mode="after")
    def _order(self):
        if self.end <= self.start:
            raise ValueError("end must be after start")
        return self


class DateOptionOutputSchema(BaseModel):
    id: int
    start: UtcOutput
    end: UtcOutput
    author_id: int
    author_login: str
    votes: int
    voters: list[str]
    voted_by_me: bool


class VotesInputSchema(BaseModel):
    """Approval vote: every option id the user is fine with. An empty list clears the vote."""

    date_option_ids: list[int] = []


class CloseVotingSchema(BaseModel):
    # Needed only on a tie: one of the leaders, chosen by the creator.
    date_option_id: int | None = None


class ResultsSchema(BaseModel):
    status: str
    options: list[DateOptionOutputSchema]
    leaders: list[int]
    is_tie: bool
    voters_count: int
    members_count: int
    final: DateOptionOutputSchema | None = None
    resolved_by: str | None = None
