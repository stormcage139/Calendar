# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Course project: a collaborative event-planning service (create an event, invite participants, collect availability and votes on dates/places, pick the final slot). `plan.md` holds the full MVP scope, entity list and roadmap; `README.md` holds team setup and Git workflow. Docs, UI strings and commit-facing text are mostly in Russian.

- `backend/` — FastAPI + async SQLAlchemy + Alembic, managed with `uv` (Python >= 3.14).
- `frontend/` — React 19 + TypeScript + Vite, plain `fetch` (no router library, no state library).

## Commands

Backend (run from `backend/` — the SQLite path `./calendar_data.db`, `info.log` and Alembic's `from src.backend...` imports are all relative to the CWD):

```bash
uv sync
uv run alembic upgrade head
uv run uvicorn backend.main:app --app-dir src --reload     # API on :8000, docs at /docs
uv run pytest                                               # all tests
uv run pytest tests/test_users_crud.py::test_user_crud      # single test
uv run alembic revision --autogenerate -m "msg"             # after model changes; review the generated file
```

Frontend (run from `frontend/`):

```bash
npm install
npm run dev                 # Vite on :5173, proxies /api/* -> http://127.0.0.1:8000 (prefix stripped)
npm run build               # tsc -b && vite build
npm run lint                # oxlint
npm test                    # tests/api.test.mjs — node:test against mocked fetch
npm run test:integration    # spins up the real backend (backend/.venv/bin/python or $BACKEND_PYTHON) on in-memory SQLite
```

Frontend tests import `.ts` sources directly with Node (relies on Node's native type stripping), using `tests/environment.mjs` to fake `sessionStorage` etc. `run_back.sh` / `run_front.sh` at the repo root are convenience launchers.

## Backend architecture

Layering under `backend/src/backend/`:

- `api/v1/routers/` — FastAPI routers, mounted in `main.py` (`auth` and `user` at root, `friends` at `/friends`, `events` at `/events`). Routers catch exceptions and translate them to `HTTPException`.
- `api/deps.py` — `SessionDep` (per-request `AsyncSession`). Auth dependency is `get_current_user` in `routers/auth.py` (OAuth2 bearer JWT); other routers import it from there.
- `repositories/` — plain async functions taking an `AsyncSession` that do the queries and `commit()`/`rollback()` themselves. Routers call these, aliased as `*_crud`.
- `models/` — SQLAlchemy 2.0 `Mapped` models on a shared `Base`. Every model must be imported in `models/__init__.py` so Alembic autogenerate and `Base.metadata.create_all` (used by tests) see it.
- `schemas/` — Pydantic input/output schemas (`*InputSchema`, `*OutputSchema`).
- `core/config.py` — `config` object (DB URL, JWT settings) and `get_logger`; also configures root logging. `core/security.py` — password hashing (pwdlib/argon2) and JWT helpers.
- `exceptions/` — domain errors such as `AlreadyExistsError`, raised by repositories.

Events: `Event` has a creator plus members via the `EventMember` association model; "user's events" means created-by OR member-of.

Tests: `tests/conftest.py` provides a `db_session` fixture with a fresh in-memory SQLite DB per test (`pytest-asyncio`, mark tests with `@pytest.mark.asyncio`). Repository functions are tested directly against it. The frontend integration test's `frontend/tests/backend_fixture.py` instead overrides `get_async_session` on the real app.

## Frontend architecture

- `src/Root.tsx` switches between `App` (auth + dashboard) and `pages/Planner` based on `location.hash === "#calendar"` — there is no router.
- `src/api/client.ts` — the single `request()` wrapper: prefixes `VITE_API_URL` (default `/api`), attaches the bearer token from `sessionStorage`, applies a 15s timeout, throws `ApiError`, and on 401 clears the session and dispatches `SESSION_EXPIRED_EVENT`. `api/auth.ts` and `api/calendar.ts` build typed endpoint calls on top of it.
- `frontend/BACKEND_INTEGRATION.md` documents which endpoints the frontend consumes and a list of known backend issues/requested changes. It is out of date: the frontend still calls `/users`, `/users/me/` and `DELETE /users/{id}`, but the backend now serves auth at `/register`, `/login`, `/me`, `/token_test` and mounts the user router without a `/users` prefix. Check `main.py` and the routers before changing API calls on either side.
