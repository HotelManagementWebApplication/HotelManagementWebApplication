# RAG

The customer chatbot reads only the approved customer-facing policy from the
repository root `customer-policy.md`. The internal `rule.md` is never loaded
into the customer retrieval collection. Keep customer policy terms in the
customer document and implementation or staff instructions in the internal
document; do not duplicate customer terms between them. Ingestion splits the
customer policy by headings and preserves citations to its source lines.

Room availability, current prices, active services, and a signed-in customer's
own reservation/payment status are live data. Retrieve them only through the
corresponding authorized backend API; never copy them into the document index or
connect the agent directly to SQL Server.

## Qdrant index

Start only the persistent local Qdrant service from the repository root:

```powershell
Set-Location C:\web-hotel-mis
docker compose up -d qdrant
```

From the `agent/` directory, the installed project exposes the exact
`index-customer-policy = rag.indexing:main` entry point:

```powershell
Set-Location C:\web-hotel-mis\agent
.\.venv\Scripts\index-customer-policy.exe
```

Run that same command after each change to `customer-policy.md`. The indexer
ensures the `customer_policy` collection uses 768-dimensional cosine vectors,
compares each chunk's content hash, and applies only the needed changes:

- unchanged hashes are not sent to Gemini for re-embedding;
- changed or new chunks are embedded and upserted;
- chunks no longer present in `customer-policy.md` are deleted from Qdrant.

The internal `rule.md` is never an input to this index. Runtime retrieval is
Gemini-only and has no offline website fallback; test mocks do not represent a
runtime provider.

Inspect collection metadata and exact point count with Qdrant's REST API:

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
