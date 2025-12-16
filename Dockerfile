# ---- Frontend build ---------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Backend ---------------------------------------------------------------
FROM python:3.11-slim

WORKDIR /app

# 🔧 System deps for pycairo (and other compiled libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# 🐍 Install Python deps
RUN pip install --no-cache-dir -r requirements.txt

# Copy the backend + legacy assets
COPY . .
# Copy the freshly built frontend bundle
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
