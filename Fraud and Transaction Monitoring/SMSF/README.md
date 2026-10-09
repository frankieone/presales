# SMSF — Keystone SMSF

A trustee registers on the website, sets up a new self managed super fund in the client portal, and adds the fund's other members. The fund exists in FrankieOne before it has a name or an ABN. Members are checked on email and phone as they're added; anyone flagged is held, and the rest verify on their own phone.

```bash
npm run setup   # first time: installs ../app
npm run dev     # http://localhost:8095
```

Needs `../app/.env.local` — see the [main README](../README.md#setup).

## What it shows

| Step | What the trustee does | What FrankieOne runs |
|---|---|---|
| Registration | Name, email, mobile, password | Creates the primary contact and an unnamed fund (TRUST) anchored by an application ID. `Device-Email-Phone-NoAML` on email, phone, device and IP |
| Login | Logs in to the client portal | The same workflow again, with a new device session |
| Members | Chooses individual or corporate trustees, adds members | `Email-Phone-NoAML` on each: email and phone only, no KYC. Flagged members are held |
| Member verifies | Opens their link on their own phone | Embedded OneSDK captures their device; `Device-Email-Phone-NoAML`; then hosted ID photo and selfie |
| Submit | Enters the fund name and their address | Renames the fund; the workflow runs once more over every device session |

## Demo script

1. **Fill with JAMES TESTONE** → **Register**. Log in with his email and any password.
2. **Fill with demo details** on the application. The fund is TESTONE FAMILY SUPERANNUATION FUND.
3. **Members** → choose **Individual trustees**, then fill and add each demo person:
   - **Alex Harper**: `highrisk.com` email → *Under review*.
   - **Jordan Reed**: `0403 666 666` → *Under review*.
   - **Casey Morgan**: clean → **Send confirmation link**. Scan Casey's QR code from the presenter panel (shield icon, bottom right) on a phone on the same Wi-Fi, and complete the device check and ID capture.
4. **Submit application**, then show the fund, its members and each result in the FrankieOne Portal.
### After onboarding: payments and account takeover

5. **Payments** → pay **$2,500** to anyone: it goes through, and nothing is flagged.
6. Pay **$15,000**: the customer is asked to verify their ID before it's released, and the Portal shows the payment rated high on "Transaction amount above $10,000", with an `ACTIVITY_FRAUD` alert for review.
7. **Account takeover:** **Security** → change the email to `james.testone@highrisk.com` → **Save contact details**. The customer only sees "updated". In the Portal, the email change is rated high and the re-run fraud check comes back Review on the new email. A payment straight after sits next to that alert.

