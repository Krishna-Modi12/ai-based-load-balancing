FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install --no-cache-dir --default-timeout=300 --retries=5 -r requirements.txt
COPY backend/app ./app
COPY alembic.ini .
COPY db ./db
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
