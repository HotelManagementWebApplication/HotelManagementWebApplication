# Hotel MIS Customer Agent

FastAPI service for the customer-facing MaM Hotel chatbot.

## Boundaries

- RAG reads only the dedicated customer policy in the repository root
  `customer-policy.md` and preserves citations to its canonical lines. The
  internal `rule.md` is not included in customer retrieval.
- Current room, service, availability, reservation and payment data comes only
  from allow-listed Spring Boot APIs.
- The agent never connects to SQL Server.
- Private reservation data requires the customer's Bearer token and the backend
  remains responsible for ownership and authorization checks.
- Runtime is Gemini-only: `gemini-embedding-2` is used for semantic retrieval
and `gemini-3.5-flash-lite` for grounded Vietnamese answers. There is no offline
  website fallback; mocks are tests only.

## Run locally

Install Python 3.11 or newer. From the repository root, create the venv and
install the project:

```powershell
Set-Location C:\web-hotel-mis
py -3.11 -m venv agent\.venv
.\agent\.venv\Scripts\python.exe -m pip install -e .\agent
Set-Location C:\web-hotel-mis\agent
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

Enter `GEMINI_API_KEY` only in the editor. Do not put credentials in a command,
the template, or shell history. The `.env.example` values are the local
contract: Gemini provider, the two approved model names, 768 dimensions,
Qdrant at `http://localhost:6333`, collection `customer_policy`, backend at
8080, explicit frontend CORS origins, and agent port 8090.

Start Qdrant separately from the repository root. To support the backend too,
start the existing SQL Server services; neither command resets or deletes SQL
Server data:

```powershell
Set-Location C:\web-hotel-mis
docker compose up -d qdrant
docker compose up -d sqlserver sqlserver-init
```

Index or re-index only `customer-policy.md` with the actual installed project
entry point:

```powershell
Set-Location C:\web-hotel-mis\agent
.\.venv\Scripts\index-customer-policy.exe
```

The indexer is delta-based: unchanged content hashes are not re-embedded,
changed/new chunks are embedded, and chunks removed from `customer-policy.md`
are deleted from Qdrant. `rule.md` is never indexed. A valid Gemini account and
key must authenticate before indexing or serving; the current environment's
401 credential is not assumed to work, and startup fails visibly instead of
falling back.

Run the services in separate terminals:

```powershell
Set-Location C:\web-hotel-mis\backend
mvn spring-boot:run
```

```powershell
Set-Location C:\web-hotel-mis\agent
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8090
```

```powershell
Set-Location C:\web-hotel-mis\frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

The FastAPI app is `app.main:app`, the backend listens on 8080, the agent on
8090, and Vite on 5173. Open the customer portal and use the **Hỏi MaM** button.

Inspect the Qdrant collection and exact point count:

```powershell
$collection = "customer_policy"
Invoke-RestMethod "http://localhost:6333/collections/$collection" |
  ConvertTo-Json -Depth 20
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:6333/collections/$collection/points/count" `
  -ContentType "application/json" `
  -Body '{"exact":true}' |
  ConvertTo-Json -Depth 5
```

## HTTP contract

- `GET /health`: liveness and selected provider.
- `POST /agent-api/chat`: complete JSON response.
- `POST /agent-api/chat/stream`: Server-Sent Events named `metadata`, `token`
  and `done`.

Chat request:

```json
{
  "message": "Hủy đúng 48 giờ có mất cọc không?",
  "history": [
    { "role": "user", "content": "Tôi đã đặt phòng." }
  ]
}
```

## Package map

- `app/`: FastAPI configuration, schemas and streaming entrypoint.
- `agent/`: intent routing and grounded generation contract.
- `rag/`: Markdown ingestion and retrieval indexes. The customer policy is a
  separate approved source; internal rules are not part of this index.
- `tools/`: typed, allow-listed backend API calls.
- `policies/`: deterministic prompt-injection and data-access controls.
- `evals/`: Vietnamese policy, abstention and security evaluation cases.
- `tests/`: unit, API, orchestration, RAG and safety tests.

## Docker image

Build from the repository root so the customer policy is included:

```powershell
docker build -f agent/Dockerfile -t web-hotel-mis-agent .
docker run --rm -p 8090:8090 `
  -e BACKEND_API_BASE_URL=http://host.docker.internal:8080 `
  web-hotel-mis-agent
```
