FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi==0.116.1 uvicorn[standard]==0.35.0
COPY app.py .
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
