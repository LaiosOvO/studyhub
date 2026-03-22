FROM python:3.12-slim

WORKDIR /app

# System dependencies for weasyprint, lxml, scikit-learn
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    libxml2-dev \
    libxslt1-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv via pip (avoids slow ghcr.io pull in China)
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ uv

# Copy dependency files first for caching
COPY pyproject.toml uv.lock* ./

# Install dependencies
RUN uv sync --no-dev --no-install-project

# Copy application code
COPY . .

# Install the project itself
RUN uv sync --no-dev

EXPOSE 8000

# Default: run API server
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
