# Fraud and Transaction Monitoring

Working onboarding demos that show FrankieOne's email, phone, device and IP checks, and what they look like in the FrankieOne Portal. One shared app runs as three placeholder-branded examples:

| Example | Brand | Port | Journey |
|---|---|---|---|
| [Banking](Banking/) | Harbour Bank | 8093 | A business opens an account and adds directors and signatories, who each verify on their own phone |
| [Superannuation](Superannuation/) | Summit Super | 8094 | A member joins a fund, logs in and completes their membership |
| [SMSF](SMSF/) | Keystone SMSF | 8095 | A trustee sets up a fund and adds members and trustees, who each verify on their own phone |

Every screen shows a banner naming the FrankieOne account it's connected to.

```
Fraud and Transaction Monitoring/
├── app/              the shared app (Vite, React)
│   └── src/config/verticals.js   everything that differs between the examples
├── Banking/          npm run dev → app as Harbour Bank
├── Superannuation/   npm run dev → app as Summit Super
└── SMSF/             npm run dev → app as Keystone SMSF
```

## Setup

Needs Node 20+.

```bash
cd app
npm install
cp env.example .env.local   # then fill in the FrankieOne account
```

`.env.local` is never committed. Its values reach the browser bundle, so use a demo account only.

## Running

From an example's folder:

```bash
cd Banking && npm run dev
```

Or from `app/`:

```bash
npm run all        # all three, on ports 8093–8095
npm run banking    # or super, smsf
npm test           # start-up checks only
```

### Start-up checks

Every run first checks the account the demo depends on, printing pass or fail per check:

- `.env.local` is complete, and the three example configs are complete
- the API is reachable and the key is accepted
- the workflows the demos call exist: `Device-Email-Phone-NoAML`, `Email-Phone-NoAML`
- a OneSDK session can be issued (needed for device capture on phones)
- a business or fund can be created unnamed and renamed later
- a device session can be registered
- the Sardine rules still fire: a `highrisk.com` email and `0403 666 666` both come back HIGH, and clean details pass
- a hosted ID capture link can be generated

The servers start even if a check fails, but read the failures before you present. Each run creates a few throwaway entities named `PREFLIGHT …` in the account. Skip the checks with `node scripts/start.js all --skip-checks`.

## How the checks are used

| When | Workflow | What it checks |
|---|---|---|
| Registration, login and submission (the person at the keyboard) | `Device-Email-Phone-NoAML` | Email, phone, device and IP; each run covers every device session so far |
| A related person is added by someone else | `Email-Phone-NoAML` | Email and phone only, no KYC, so a flagged person is held before any identity check is paid for |
| A related person verifies on their own phone | `Device-Email-Phone-NoAML`, then hosted ID capture | Their own device and IP first, then ID photo and selfie in the same session |

## Presenter panel

The faint shield icon in the bottom-right corner (or **Ctrl+Shift+R**) opens a panel the audience shouldn't see:

- **People's links:** a QR code for each related person, standing in for the SMS or email the customer would send.
- **Autofill contact details:** pick a fraud email or phone for the Fill buttons.
- VPN and location risk attributes for activities.
- **Reset demo:** wipes this example's saved state in the browser. You can also open `/reset`.

## Tailoring for a prospect

Everything that differs between examples is in `app/src/config/verticals.js`: brand, colour theme, website and portal wording, what registration creates in FrankieOne, the related people and their declaration, and the demo people. Replace `app/src/components/Logo.jsx` with a real logo. Colour themes are in `app/src/config/index.js`.

Applicants are FrankieOne's [published UAT test identities](https://docs.frankieone.com/docs/uat-test-data); keep their details exactly as published so KYC matches. Related people are fictional.

## What the account needs

The demos expect these on the FrankieOne account in `.env.local`:

- **Workflows:** `Device-Email-Phone-NoAML` (fraud step with device, email and phone) and `Email-Phone-NoAML` (fraud step with email and phone only), both without KYC or AML steps.
- **Sardine rules, Live (not Shadow):** one rating an email at `highrisk.com` as high risk, and one rating a phone number containing `666666` as high risk.
- **OneSDK:** embedded sessions enabled, with `VITE_FRANKIE_BFF_URL` pointing at the environment's session server.

The start-up checks confirm each of these.

## Things to know

- **Date of birth:** registration sends a date of birth without asking for one, because the device workflow needs one to run.
- **Device capture:** a member's device is captured by OneSDK embedded in the app's own page (`/m/<entity>`), which then hands off to hosted ID capture. A hosted link on its own did not return device data in our testing.
- **No return page after ID capture:** plain `http://` return addresses are rejected, so the person stays on the hosted flow's own completion screen.
- **Network:** the dev server listens on the LAN so phones can reach it, and the API key is in the browser bundle. Fine on a trusted network; be careful on shared Wi-Fi. Phones must be on the same Wi-Fi as the laptop.
- `/device-check/<entity>` is a bare embedded-OneSDK test page, kept for troubleshooting.
