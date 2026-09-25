#!/bin/sh
set -e

echo "Applying database migrations (Alembic)..."
alembic upgrade head

echo "Seeding initial data..."
python -m app.seed || echo "Seed skipped or failed non-fatally."

echo "Starting Uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
