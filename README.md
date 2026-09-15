# Calendar

Инструкция для разработки проекта командой.

## Структура проекта

- `backend/` — API на FastAPI, SQLAlchemy и Alembic.
- `frontend/` — клиентское приложение на React, TypeScript и Vite.

## Что нужно установить

До начала работы установите:

- Git;
- Python 3.14 или новее;
- `uv` — менеджер Python-зависимостей;
- Node.js с npm (рекомендуется актуальная LTS-версия).

Проверка установки:

```bash
git --version
python --version
uv --version
node --version
npm --version
```

Установить `uv` можно по официальной инструкции: <https://docs.astral.sh/uv/getting-started/installation/>.

## Первый запуск после клонирования

Клонируйте репозиторий и перейдите в его папку:

```bash
git clone <URL_РЕПОЗИТОРИЯ>
cd Calendar
```

### Бэкенд

```bash
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn backend.main:app --app-dir src --reload
```

После запуска API доступно по адресу <http://127.0.0.1:8000>. Проверка текущего тестового маршрута:

```bash
curl http://127.0.0.1:8000/test
```

Документация FastAPI:

- Swagger UI: <http://127.0.0.1:8000/docs>
- ReDoc: <http://127.0.0.1:8000/redoc>

`uv sync` создает окружение и устанавливает зависимости из `pyproject.toml` и `uv.lock`. Повторно выполнять его после каждого запуска не нужно, только после изменения Python-зависимостей или получения таких изменений из Git.

### Фронтенд

В отдельном терминале из корня проекта:

```bash
cd frontend
npm install
npm run dev
```

Vite выведет адрес приложения, обычно это <http://localhost:5173>.

Для проверки production-сборки:

```bash
npm run build
npm run lint
```

## Работа с базой данных и миграциями

Локальная база SQLite создается в `backend/calendar_data.db` и не должна отправляться в Git. Миграции являются частью проекта и должны коммититься.

После получения новой миграции:

```bash
cd backend
uv run alembic upgrade head
```

После изменения моделей:

```bash
cd backend
uv run alembic revision --autogenerate -m "описание изменения"
uv run alembic upgrade head
```

Перед коммитом проверьте созданную миграцию вручную: автогенерация не всегда корректно определяет переименования и сложные изменения схемы.

## Ежедневный Git-процесс

Перед началом работы обновите локальную ветку:

```bash
git switch master
git pull --ff-only origin master
git switch -c feature/краткое-описание
```

Работайте в собственной ветке. Перед коммитом проверьте изменения:

```bash
git status
git diff
```

Добавьте только нужные файлы и создайте понятный коммит:

```bash
git add путь/к/файлам
git commit -m "Добавить описание изменения"
```

Отправьте ветку на GitHub:

```bash
git push -u origin feature/краткое-описание
```

Затем создайте Pull Request в `master`. Перед слиянием дождитесь проверки коллегами и убедитесь, что сборка и тесты проходят.

## Как получить изменения коллеги

Если работа идет в вашей feature-ветке:

```bash
git fetch origin
git merge origin/master
```

Либо обновите только `master`, а затем создайте новую ветку от него:

```bash
git switch master
git pull --ff-only origin master
```

Не используйте `git pull` с незакоммиченными изменениями. Сначала завершите работу коммитом или временно сохраните изменения:

```bash
git stash push -m "незавершенная работа"
git pull --ff-only origin master
git stash pop
```

## Как смержить изменения

Предпочтительный способ — Pull Request на GitHub: автор отправляет ветку, другой участник проверяет код, после чего ветка сливается в `master`.

Если нужно выполнить merge локально:

```bash
git switch master
git pull --ff-only origin master
git merge feature/краткое-описание
git push origin master
```

При конфликте:

1. Откройте файлы, перечисленные командой `git status`, и вручную выберите правильный вариант.
2. Удалите маркеры `<<<<<<<`, `=======`, `>>>>>>>`.
3. Проверьте проект и добавьте исправленные файлы:

```bash
git add путь/к/исправленному-файлу
git commit
git push
```

Если merge нужно отменить до завершения:

```bash
git merge --abort
```

## Что не нужно коммитить

Не добавляйте в репозиторий:

- `backend/calendar_data.db` и другие локальные базы;
- `backend/.venv/`;
- `frontend/node_modules/`;
- `frontend/dist/`;
- секреты, пароли и локальные `.env`-файлы.

Если для проекта понадобятся настройки окружения, добавьте безопасный `.env.example` без настоящих секретов и опишите переменные в этом README.

## Быстрый порядок работы

```bash
git pull --ff-only origin master
cd backend && uv sync && uv run alembic upgrade head
cd ../frontend && npm install
npm run build
```

После этого запускайте бэкенд и фронтенд в отдельных терминалах и работайте только в своей feature-ветке.