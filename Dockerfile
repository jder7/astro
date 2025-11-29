# Build stage
FROM python:3.11-alpine AS builder

WORKDIR /app

# Optional: system deps if you need them
# RUN apk add --no-cache build-base

COPY requirements.txt .
RUN python -m venv /venv \
    && . /venv/bin/activate \
    && pip install --no-cache-dir -r requirements.txt

# Runtime stage
FROM python:3.11-alpine AS runner
WORKDIR /app

# Copy virtualenv and app code
COPY --from=builder /venv /venv
ENV PATH=/venv/bin:$PATH

COPY . .

# FastAPI will listen on 8000 inside the container
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
