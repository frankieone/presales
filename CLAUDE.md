# Presales Repo — Claude Instructions

## Git Workflow
- **Always create feature branches and open PRs** — never push directly to main
- Use descriptive branch names (e.g. `feat/progress-bar`, `fix/button-visibility`)
- Create PRs with `gh pr create` and share the URL with the user

## Public repo — what belongs here

**This repo is public.** Only generic, unbranded demos belong in it. ACME is a
fictional customer and is safe to use for examples.

Demos built or branded for a real customer live in a **separate private repo in
a separate parent folder** (`~/Presales Customers/`), never in this working
tree. Do not re-create them here, even temporarily and even untracked —
untracked is not protected. Every git command reaches the whole working tree, so
a branch cut from the wrong base, or a `git stash -u`, will pick them up.

To start a customer demo, copy a generic demo from here into that folder. Copy
from the generic demo, never from another customer's copy.

The root `.gitignore` is an allowlist: everything at the top level is ignored and
the tracked directories are re-included explicitly. A new directory has to be
added deliberately to enter the repo.

### Writing for a public repo

PR titles, PR bodies, commit messages and file contents here are all public.
Do not name a real customer in any of them — including when explaining why a
safeguard exists. Describe the change, not the incident behind it.

## Code Practices
- Never commit `.env` or secrets files
- Test changes locally before committing
- Keep commits focused — one logical change per commit

## Project Info
- **HostedOneSDK V2**: runs on port 4568
- **KYB POC V1 ACME** (`acme-poc/`): runs on port 6513
- **KYB V2 ACME**: additional project in the repo
- **Fraud and Transaction Monitoring**: one shared app (`app/`) run as Banking (8093), Superannuation (8094) and SMSF (8095); `npm test` in `app/` runs live start-up checks
