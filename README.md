# Presales

A collection of demo applications built with FrankieOne's identity verification and KYB products for presales engagements.

## Projects

| Project | Description | Stack | Port |
|---------|-------------|-------|------|
| **HostedOneSDK V2** | Generates hosted verification links using FrankieOne's OneSDK | Next.js, Tailwind CSS | 4568 |
| **HostedOneSDK V2 Proove** | Hosted verification with Proove prefill integration | Next.js, Tailwind CSS | 4568 |
| **EmbeddedOneSDK** | Embedded Split Flow demo using FrankieOne's OneSDK | Vite, React | 5173 |
| **KYB POC V1 ACME** | KYB (Know Your Business) proof-of-concept with entity workflow visualization | Next.js, React Flow, Tailwind CSS | 6513 |
| **KYB V2 ACME** | Enhanced KYB demo with entity workflow visualization | Next.js, React Flow, Zustand, Tailwind CSS | 6816 |
| **ANZ** | Entity data samples and fetch scripts | Node.js scripts | — |

## Getting Started

Each project is self-contained with its own dependencies. To run a project:

```bash
cd "<project-folder>"
npm install
npm run dev
```

### Environment Variables

All projects require a `.env.local` file (not committed to the repo). Environment variables use the `VITE_FRANKIE_*` prefix for Vite projects or `NEXT_PUBLIC_*` / server-side env vars for Next.js projects. Typical variables include:

- `VITE_FRANKIE_CUSTOMER_ID` / `FRANKIE_CUSTOMER_ID`
- `VITE_FRANKIE_API_KEY` / `FRANKIE_API_KEY`
- `VITE_FRANKIE_CUSTOMER_CHILD_ID`
- `VITE_FRANKIE_BFF_URL`

### Docker

Projects include Docker and docker-compose support. When using Docker, pass the env file explicitly:

```bash
docker compose --env-file .env.local up
```

## Utilities

- `download-attachments.mjs` — Downloads entity attachments via the FrankieOne API
- `download-entity-attachments.sh` — Shell script variant for bulk attachment downloads

## Known Dependency Notes

The following transitive dependency vulnerabilities exist upstream and cannot be resolved without breaking changes:

- **postcss** (moderate) — Bundled inside `next`; awaiting upstream fix from Next.js
- **uuid** (moderate) — Transitive dependency of `@frankieone/one-sdk`; awaiting upstream fix
