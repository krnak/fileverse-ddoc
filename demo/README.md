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

Start the gate server (URL configured via `VITE_GATE_BASE_URL` in `.env`):

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
| Create | POST | `/res` | Upload new document (multipart/form-data), returns `{success, files: [{filename, uuid}]}` |
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

The gate server uses cookie-based authentication. When you first open the demo, an authentication overlay will appear prompting for the access token.

The access token is displayed in the gate server console on startup:

```
INFO  ========================================
INFO          Oxigraph Gate Starting
INFO  ========================================
INFO  Access Token:  a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6
INFO  ========================================
```

After successful authentication, a session cookie is set that persists for 3 months.
