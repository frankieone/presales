# Custom Risk Attributes

These three custom attributes are sent to FrankieOne as `customAttributes` on the
individual (see `app/api/create-entity/route.ts` and `app/api/session/[id]/route.ts`).
They are scored by the `default` risk profile in `public/risk_config.json` using the
`custom_attribute_lookup` handler. All have `defaultScore: 0`.

## Source of Funds — `source_of_funds`

| Value                | Score |
| -------------------- | ----- |
| Employment / Salary  | 5     |
| Business Income      | 10    |
| Investments          | 10    |
| Savings              | 5     |
| Inheritance          | 15    |
| Government Benefits  | 5     |
| Other                | 20    |

## Occupation — `occupation`

| Value                | Score |
| -------------------- | ----- |
| Accountant           | 5     |
| Architect            | 5     |
| Business Owner       | 10    |
| Consultant           | 5     |
| Designer             | 5     |
| Doctor               | 5     |
| Engineer             | 5     |
| Farmer               | 5     |
| Financial Advisor    | 10    |
| Government Employee  | 10    |
| Lawyer               | 10    |
| Manager              | 5     |
| Nurse                | 5     |
| Real Estate Agent    | 15    |
| Retired              | 5     |
| Sales Professional   | 5     |
| Student              | 10    |
| Teacher              | 5     |
| Tradesperson         | 5     |
| Other                | 15    |

## Visa Status — `visa_status`

| Value                 | Score |
| --------------------- | ----- |
| Australian Citizen    | 5     |
| Permanent Resident    | 5     |
| New Zealand Citizen   | 5     |
| Temporary Visa Holder | 20    |
| Other                 | 25    |

## Risk Levels (default profile)

| Label   | Total score range | Policy |
| ------- | ----------------- | ------ |
| LOW     | ≤ 30              | SDD    |
| MEDIUM  | > 30              | CDD    |
| (HIGH)  | see `risk_config.json` `levels` for full bands |
