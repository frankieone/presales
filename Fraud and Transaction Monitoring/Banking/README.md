# Business banking — Harbour Bank

A business registers for an account, completes its application in online banking, and adds its directors and signatories. Each person is checked on email and phone as they're added; anyone flagged is held before identity verification, and the rest verify on their own phone.

```bash
npm run setup   # first time: installs ../app
npm run dev     # http://localhost:8093
```

Needs `../app/.env.local` — see the [main README](../README.md#setup).

## What it shows

| Step | What the applicant does | What FrankieOne runs |
|---|---|---|
| Registration | Name, email, mobile, password | Creates the primary contact and an unnamed business (COMPANY) anchored by an application ID. `Device-Email-Phone-NoAML` on email, phone, device and IP |
| Login | Logs in to online banking | The same workflow again, with a new device session |
| Directors | Adds directors and signatories | `Email-Phone-NoAML` on each: email and phone only, no KYC. Flagged people are held |
| Director verifies | Opens their link on their own phone | Embedded OneSDK captures their device; `Device-Email-Phone-NoAML`; then hosted ID photo and selfie |
| Submit | Enters the business name and their address | Renames the business; the workflow runs once more over every device session |

## Demo script

1. **Fill with JAMES TESTONE** → **Register**. Log in with his email and any password.
2. **Fill with demo details** on the application. The business is TESTONE TRADING PTY LTD.
3. **Directors** → fill and add each demo person:
   - **Alex Harper**: `highrisk.com` email → *Under review*.
   - **Jordan Reed**: `0403 666 666` → *Under review*.
   - **Casey Morgan**: clean → **Send confirmation link**. Scan Casey's QR code from the presenter panel (shield icon, bottom right) on a phone on the same Wi-Fi, and complete the device check and ID capture.
4. **Submit application**, then show the results in the FrankieOne Portal: the business with its directors, Alex's email flag, Jordan's phone flag, and Casey's device.
