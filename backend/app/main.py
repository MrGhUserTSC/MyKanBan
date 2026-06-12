import logging
import os
from pathlib import Path
import re
from secrets import token_urlsafe

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import (
    MVP_USERNAME,
    get_board_for_username,
    initialize_database,
    save_board_for_username,
)
from app.models import (
    AiChatRequest,
    AiChatResponse,
    CardPayload,
    AiChatStructuredResponse,
    BoardPayload,
    LoginPayload,
    OpenRouterTestResponse,
    SessionResponse,
)
from app.openrouter import (
    OpenRouterConfigError,
    request_openrouter_chat,
    request_structured_openrouter_chat,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = PROJECT_ROOT / ".env"
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
FRONTEND_DIR = STATIC_DIR / "frontend"
LOCAL_FRONTEND_DIR = PROJECT_ROOT / "frontend" / "out"
ACTIVE_FRONTEND_DIR = FRONTEND_DIR if FRONTEND_DIR.exists() else LOCAL_FRONTEND_DIR
INDEX_FILE = STATIC_DIR / "index.html"
FRONTEND_INDEX_FILE = ACTIVE_FRONTEND_DIR / "index.html"
DB_PATH = Path(os.getenv("PM_DB_PATH", str(PROJECT_ROOT / "backend" / "data" / "pm.db")))
SESSION_COOKIE_NAME = "pm_session"
MVP_PASSWORD = "password"
PLAYWRIGHT_AI_MODEL = "stub-playwright"

logger = logging.getLogger(__name__)


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue

        cleaned_value = value.strip().strip("\"'")
        os.environ.setdefault(key, cleaned_value)


load_env_file(ENV_FILE)


def get_current_user(request: Request) -> str | None:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return None

    sessions: dict[str, str] = request.app.state.sessions
    return sessions.get(session_id)


def build_stub_ai_response(
    board: BoardPayload,
    user_message: str,
) -> AiChatStructuredResponse:
    normalized = user_message.lower()

    if "create a new card titled" in normalized and "backlog" in normalized:
        title_match = re.search(r"titled\s+(.+?)\s+in\s+", user_message, re.IGNORECASE)
        details_match = re.search(r"details\s+(.+?)[.?!]?\s*$", user_message, re.IGNORECASE)
        title = title_match.group(1).strip() if title_match else "AI follow-up"
        details = (
            details_match.group(1).strip()
            if details_match
            else "Added by the Playwright AI stub."
        )
        next_board = board.model_copy(deep=True)
        card_id = "card-ai-follow-up"
        next_board.cards[card_id] = CardPayload(
            id=card_id,
            title=title,
            details=details,
        )

        for column in next_board.columns:
            if column.id == "col-backlog":
                if card_id not in column.cardIds:
                    column.cardIds.append(card_id)
                break

        return AiChatStructuredResponse(
            reply=f'Added "{title}" to Backlog.',
            board=next_board,
        )

    total_cards = sum(len(column.cardIds) for column in board.columns)
    backlog = next((column for column in board.columns if column.id == "col-backlog"), None)
    backlog_count = len(backlog.cardIds) if backlog else 0
    return AiChatStructuredResponse(
        reply=(
            f"You currently have {len(board.columns)} columns and {total_cards} cards. "
            f"Backlog contains {backlog_count} cards."
        ),
        board=None,
    )


def find_dropped_ids(
    current: BoardPayload,
    next_board: BoardPayload,
) -> tuple[set[str], set[str]]:
    current_column_ids = {column.id for column in current.columns}
    next_column_ids = {column.id for column in next_board.columns}
    current_card_ids = set(current.cards.keys())
    next_card_ids = set(next_board.cards.keys())

    dropped_columns = current_column_ids - next_column_ids
    dropped_cards = current_card_ids - next_card_ids
    return dropped_columns, dropped_cards


def create_app(db_path: Path = DB_PATH) -> FastAPI:
    initialize_database(db_path)

    app = FastAPI(title="Project Management MVP")
    app.state.sessions = {}
    app.state.db_path = db_path
    app.state.chat_history = {}

    @app.get("/api/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok", "service": "pm-backend"}

    @app.get("/api/session", response_model=SessionResponse)
    def read_session(request: Request) -> SessionResponse:
        username = get_current_user(request)
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        return SessionResponse(username=username)

    @app.post("/api/login", response_model=SessionResponse)
    def login(payload: LoginPayload, response: Response) -> SessionResponse:
        if payload.username != MVP_USERNAME or payload.password != MVP_PASSWORD:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials.",
            )

        session_id = token_urlsafe(32)
        app.state.sessions[session_id] = payload.username
        response.set_cookie(
            key=SESSION_COOKIE_NAME,
            value=session_id,
            httponly=True,
            samesite="lax",
            secure=False,
            path="/",
        )
        return SessionResponse(username=payload.username)

    @app.post("/api/logout")
    def logout(request: Request, response: Response) -> Response:
        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        if session_id:
            app.state.sessions.pop(session_id, None)
            app.state.chat_history.pop(session_id, None)

        response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
        response.status_code = status.HTTP_204_NO_CONTENT
        return response

    @app.get("/api/board", response_model=BoardPayload)
    def read_board(request: Request) -> BoardPayload:
        username = get_current_user(request)
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        board = get_board_for_username(app.state.db_path, username)
        return BoardPayload.model_validate(board)

    @app.put("/api/board", response_model=BoardPayload)
    def update_board(request: Request, payload: BoardPayload) -> BoardPayload:
        username = get_current_user(request)
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        board = save_board_for_username(
            app.state.db_path,
            username,
            payload.model_dump(),
        )
        return BoardPayload.model_validate(board)

    @app.post("/api/ai/test", response_model=OpenRouterTestResponse)
    async def test_openrouter(request: Request) -> OpenRouterTestResponse:
        username = get_current_user(request)
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        prompt = "What is 2+2? Reply with only the answer."
        try:
            result = await request_openrouter_chat(prompt)
        except OpenRouterConfigError as error:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=str(error),
            ) from error
        except httpx.HTTPError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"OpenRouter request failed: {error}",
            ) from error

        return OpenRouterTestResponse(
            answer=result.content,
            model=result.model,
            prompt=prompt,
        )

    @app.post("/api/ai/chat", response_model=AiChatResponse)
    async def ai_chat(request: Request, payload: AiChatRequest) -> AiChatResponse:
        username = get_current_user(request)
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        session_id = request.cookies.get(SESSION_COOKIE_NAME)
        if not session_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required.",
            )

        board = BoardPayload.model_validate(
            get_board_for_username(app.state.db_path, username)
        )
        history: list[dict[str, str]] = app.state.chat_history.setdefault(session_id, [])

        if os.getenv("PM_AI_MODE") == "stub":
            structured = build_stub_ai_response(board, payload.message)
            model = PLAYWRIGHT_AI_MODEL
        else:
            try:
                result, structured = await request_structured_openrouter_chat(
                    board=board,
                    history=history,
                    user_message=payload.message,
                )
                model = result.model
            except OpenRouterConfigError as error:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=str(error),
                ) from error
            except httpx.HTTPError as error:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"OpenRouter request failed: {error}",
                ) from error

        updated = structured.board is not None
        next_board = structured.board or board

        if updated:
            dropped_columns, dropped_cards = find_dropped_ids(board, next_board)
            if dropped_columns or dropped_cards:
                logger.warning(
                    "AI board update for user %s dropped existing ids (columns: %s, cards: %s)",
                    username,
                    sorted(dropped_columns),
                    sorted(dropped_cards),
                )

            saved_board = save_board_for_username(
                app.state.db_path,
                username,
                next_board.model_dump(),
            )
            next_board = BoardPayload.model_validate(saved_board)

        history.append({"role": "user", "content": payload.message})
        history.append({"role": "assistant", "content": structured.reply})

        return AiChatResponse(
            reply=structured.reply,
            board=next_board,
            updated=updated,
            model=model,
        )

    if FRONTEND_INDEX_FILE.exists():
        app.mount(
            "/",
            StaticFiles(directory=ACTIVE_FRONTEND_DIR, html=True),
            name="frontend",
        )
    else:
        @app.get("/", response_class=FileResponse)
        def index() -> FileResponse:
            return FileResponse(INDEX_FILE)

    return app


app = create_app()
