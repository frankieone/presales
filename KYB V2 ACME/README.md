# ACME KYB POC

A Next.js proof-of-concept for KYB (Know Your Business) onboarding using the FrankieOne v2 API.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env.local` file in the project root with your FrankieOne credentials:

```bash
FRANKIE_API_V2_BASE_URL=https://api.uat.frankie.one
FRANKIE_CUSTOMER_ID=your-customer-id
FRANKIE_API_KEY=your-api-key
FRANKIE_CUSTOMER_CHILD_ID=your-customer-child-id
FRANKIE_WORKFLOW_NAME=AUS-Basic2V-TwoPlus
FRANKIE_KYB_WORKFLOW_NAME=AUS-Organization-Ownership
```

Contact your FrankieOne representative to obtain your API credentials.

### 3. Run the development server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description | Required |
|---|---|---|
| `FRANKIE_API_V2_BASE_URL` | FrankieOne v2 API base URL | Yes |
| `FRANKIE_CUSTOMER_ID` | Your FrankieOne customer ID | Yes |
| `FRANKIE_API_KEY` | Your FrankieOne API key | Yes |
| `FRANKIE_CUSTOMER_CHILD_ID` | Your FrankieOne customer child ID | No |
| `FRANKIE_WORKFLOW_NAME` | KYC workflow name | No (defaults to `AUS-Basic2V-TwoPlus`) |
| `FRANKIE_KYB_WORKFLOW_NAME` | KYB workflow name | No (defaults to `AUS-Organization-Ownership`) |
