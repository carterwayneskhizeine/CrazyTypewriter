## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set up `.env` (copy from `.env.example`) with your `VITE_POST_HOST` API endpoint
3. Run app:
   `npm run dev`

## Run with Docker

**Prerequisites:** Docker & Docker Compose

1. Create `.env` from `.env.example` and set your API endpoint
2. Build and start all containers:
   `docker compose up -d --build`
3. Access app:
   http://localhost:5111

### Docker Commands Reference

```bash
# Full rebuild and start (recommended for first run or major changes)
docker compose up -d --build

# Rebuild only sync-server (after backend changes)
docker compose up -d --build sync-server

# Rebuild only app (after frontend changes)
docker compose up -d --build app

# Restart without rebuilding
docker compose up -d

# View sync-server logs
docker compose logs sync-server --tail 50

# View all logs
docker compose logs --tail 100

# Stop all containers
docker compose down

# Clear sync database (if needed)
docker compose exec sync-server rm -f /app/data/sync.db
```

**Note:** The Send button uses nginx proxy to avoid CORS - configure target API in `.env` (e.g., `VITE_POST_HOST=https://example.com`).
