# Hosted OneSDK

A self-hosted onboarding application powered by FrankieOne's OneSDK. Generates verification links that can be sent to customers for identity verification.

## Quick Start (Docker)

### 1. Clone the repository

```bash
git clone <repo-url>
cd hosted-onesdk
```

### 2. Configure environment

```bash
cp env.example .env
```

Edit `.env` with your FrankieOne credentials:

| Variable | Description |
|---|---|
| `FRANKIE_API_BASE_URL` | FrankieOne API base URL (e.g. `https://api.uat.frankie.one`) |
| `FRANKIE_CUSTOMER_ID` | Your FrankieOne customer ID |
| `FRANKIE_CUSTOMER_CHILD_ID` | Your FrankieOne customer child ID |
| `FRANKIE_API_KEY` | Your FrankieOne API key |
| `NEXT_PUBLIC_BASE_URL` | Public URL where this app is accessible (e.g. `https://verify.yourcompany.com`) |

### 3. Run with Docker Compose

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`.

To use a different port:

```bash
PORT=8080 docker compose up -d
```

### 4. Run with Docker directly

```bash
docker build -t hosted-onesdk .
docker run -p 3000:3000 --env-file .env hosted-onesdk
```

## Local Development (without Docker)

```bash
npm install
cp env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

The dev server runs on port 4568 by default.

## How It Works

1. **Admin** visits the root page and clicks "Generate Onboarding Link"
2. The app calls the FrankieOne API to create a hosted onboarding URL
3. A unique session link is generated (e.g. `https://yourapp.com/verify/<session-id>`)
4. **Customer** opens the link, completes pre-screening questions, identity verification via OneSDK, and post-verification questions
5. Results are stored in the session and sent to FrankieOne

## Architecture

- **Next.js 16** with App Router
- **In-memory session store** (sessions do not persist across restarts)
- **FrankieOne v2 API** for identity verification
- **Standalone Docker image** (~150MB) based on Alpine Linux
