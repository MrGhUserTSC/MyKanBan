FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend /app/frontend
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_LINK_MODE=copy
ENV PATH="/app/backend/.venv/bin:$PATH"

WORKDIR /app/backend

COPY backend/pyproject.toml ./
RUN pip install --no-cache-dir uv \
  && uv sync --no-dev --no-install-project

COPY backend /app/backend
COPY --from=frontend-builder /app/frontend/out /app/backend/static/frontend

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
