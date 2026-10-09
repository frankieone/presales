# Fraud demo app

The shared app behind the Banking, Superannuation and SMSF examples. See the [folder README](../README.md) for setup, running, the start-up checks and how to tailor it.

```bash
npm install
cp env.example .env.local   # fill in the FrankieOne account
npm run all                 # or banking, super, smsf; npm test for the checks only
```
