from pydantic import BaseModel, Field


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    password: str


class SessionResponse(BaseModel):
    username: str


class BoardSummary(BaseModel):
    id: int
    name: str
    position: int
    created_at: str
    updated_at: str


class CreateBoardPayload(BaseModel):
    name: str


class RenameBoardPayload(BaseModel):
    name: str


class CardPayload(BaseModel):
    id: str
    title: str
    details: str


class ColumnPayload(BaseModel):
    id: str
    title: str
    cardIds: list[str] = Field(default_factory=list)


class BoardPayload(BaseModel):
    columns: list[ColumnPayload]
    cards: dict[str, CardPayload]


class OpenRouterTestResponse(BaseModel):
    answer: str
    model: str
    prompt: str


class ChatMessagePayload(BaseModel):
    role: str
    content: str


class AiChatRequest(BaseModel):
    message: str


class AiChatStructuredResponse(BaseModel):
    reply: str
    board: BoardPayload | None = None


class AiChatResponse(BaseModel):
    reply: str
    board: BoardPayload
    updated: bool
    model: str
