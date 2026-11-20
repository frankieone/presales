# Superannuation — Summit Super

A member joins a public-offer super fund online, logs in to member online, and completes their membership. There are no other people to add, so this example focuses on the member's own email, phone, device and IP at each step.

```bash
npm run setup   # first time: installs ../app
npm run dev     # http://localhost:8094
```

Needs `../app/.env.local` — see the [main README](../README.md#setup).

## What it shows

| Step | What the member does | What FrankieOne runs |
|---|---|---|
| Join | Name, email, mobile, password | Creates the member. `Device-Email-Phone-NoAML` on email, phone, device and IP |
| Login | Logs in to member online | The same workflow again, with a new device session |
| Complete membership | Address, employer, consolidate other super | `Device-Email-Phone-NoAML` once more, covering every device session so far |

## Demo script

1. **Fill with JAMES TESTONE** → **Register**. Log in with his email and any password.
2. **Fill with demo details** → **Submit application**.
3. In the FrankieOne Portal, show the member's workflow runs: one device and IP reading per step, plus the email and phone results.

### After onboarding: payments and account takeover

4. **Withdrawals** → pay **$2,500** to anyone: it goes through, and nothing is flagged.
5. Pay **$15,000**: the customer is asked to verify their ID before it's released, and the Portal shows the payment rated high on "Transaction amount above $10,000", with an `ACTIVITY_FRAUD` alert for review.
6. **Account takeover:** **Security** → change the email to `james.testone@highrisk.com` → **Save contact details**. The customer only sees "updated". In the Portal, the email change is rated high and the re-run fraud check comes back Review on the new email. A payment straight after sits next to that alert.

To show a flag, open the presenter panel (shield icon, bottom right) **before** pressing Fill. Under *Autofill contact details*, pick **highrisk.com** for the email or **Six sixes** for the phone. Registration then flags it in the first workflow.
