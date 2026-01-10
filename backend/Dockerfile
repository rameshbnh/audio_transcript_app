FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8017

# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8017"]

# 🔥 IMPORTANT: use gunicorn instead of uvicorn

CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "--workers", "1", "--timeout", "1200", "--bind", "0.0.0.0:8017"]
