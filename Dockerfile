# Stage 1: Build frontend
FROM node:22-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# Stage 2: Runtime backend
FROM python:3.12-slim AS runtime
WORKDIR /app

# Install Poetry and disable virtualenv creation (use system Python directly)
RUN pip install --no-cache-dir poetry \
    && poetry config virtualenvs.create false

# Install Python dependencies
COPY backend/pyproject.toml backend/poetry.lock ./
RUN poetry install --no-root --only main

# Copy backend code
COPY backend/ .

# Copy built frontend
COPY --from=frontend-build /app/frontend/dist ./app/static

# Setup data directory
RUN mkdir -p /data
VOLUME ["/data"]
ENV DATABASE_URL=sqlite:////data/conecta_tenants.db
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "cd /app && alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
