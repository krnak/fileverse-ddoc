## Demo

### Build

```bash
npm run build
```

### Development

```bash
npm run dev
```

## Document Storage

The demo uses a file storage backend via [oxigraph-gate](https://github.com/krnak/oxigraph-gate) for document persistence.

### Prerequisites

Start the gate server at `localhost:8080`:

```bash
# Start oxigraph first
oxigraph serve --location ./data

# Start the gate proxy
./oxigraph-gate
```

### URL Structure

| Route | Behavior |
|-------|----------|
| `/` | Creates a new empty document, uploads to gate, redirects to `/document/{uuid}` |
| `/document/{uuid}` | Loads document from gate, auto-saves on changes |

### API Endpoints

The demo communicates with the gate server using these endpoints:

| Action | Method | Endpoint | Description |
|--------|--------|----------|-------------|
| Create | POST | `/upload` | Upload new document (multipart/form-data), returns `{uuid}` |
| Load | GET | `/res/{uuid}` | Download document content by UUID |
| Save | PUT | `/res/{uuid}` | Replace document content (auto-save with 1s debounce) |

### Document Format

Documents are stored as TipTap JSONContent:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [{ "type": "text", "text": "Hello world" }]
    }
  ]
}
```

### Authentication

The gate server uses cookie-based authentication. Navigate to `http://localhost:8080` in your browser to log in with the access token before using the demo.
