FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY agent/pyproject.toml ./pyproject.toml
COPY agent/app ./app
COPY agent/agent ./agent
COPY agent/rag ./rag
COPY agent/tools ./tools
COPY agent/policies ./policies
COPY agent/providers ./providers
COPY customer-policy.md /customer-policy.md

RUN python -m pip install --no-cache-dir .

EXPOSE 8090

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090"]
