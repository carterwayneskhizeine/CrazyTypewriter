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
2. Build and start container:
   `docker-compose up -d --build`
3. Access app:
   http://localhost:5111

**Note:** The Send button uses nginx proxy to avoid CORS - configure target API in `.env` (e.g., `VITE_POST_HOST=https://example.com`).
