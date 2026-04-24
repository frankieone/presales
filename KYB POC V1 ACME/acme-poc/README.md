# ACME Business Onboarding — KYB/KYC POC

A proof-of-concept demonstrating ACME business onboarding with FrankieOne KYB/KYC integration.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure credentials

Copy the example env file and fill in your FrankieOne credentials:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with your values:

```
FRANKIE_CUSTOMER_ID=your-customer-id
FRANKIE_API_KEY=your-api-key
FRANKIE_CUSTOMER_CHILD_ID=your-customer-child-id
FRANKIE_API_BASE_URL=https://api.kycaml.uat.frankiefinancial.io/compliance/v1.2
```

### 3. Run the dev server

```bash
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).
