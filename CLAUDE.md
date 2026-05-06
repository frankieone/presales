# Presales Repo — Claude Instructions

## Git Workflow
- **Always create feature branches and open PRs** — never push directly to main
- Use descriptive branch names (e.g. `feat/progress-bar`, `fix/button-visibility`)
- Create PRs with `gh pr create` and share the URL with the user

## Code Practices
- Never commit `.env` or secrets files
- Test changes locally before committing
- Keep commits focused — one logical change per commit

## Project Info
- **HostedOneSDK V2**: runs on port 4568
- **KYB POC V1 ACME** (`acme-poc/`): runs on port 6513
- **KYB V2 ACME**: additional project in the repo
