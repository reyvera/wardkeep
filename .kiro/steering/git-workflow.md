# Git Workflow

inclusion: auto

## Branch Strategy

- `main` is the production-ready branch. Never push directly.
- Feature branches: `feat/<short-description>` (e.g., `feat/account-management`)
- Bugfix branches: `fix/<short-description>`
- Chore branches: `chore/<short-description>` (deps, config, docs)

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `perf`, `ci`

Scopes: `api`, `web`, `worker`, `shared`, `finance-engine`, `ai-engine`, `importers`, `docker`, `prisma`

Examples:
- `feat(finance-engine): add debt payoff calculator`
- `fix(api): correct budget overspend threshold check`
- `test(finance-engine): add property tests for balance calculation`
- `chore(docker): add health check for Redis service`

## Rules

- Keep commits atomic — one logical change per commit.
- Commit messages under 72 characters for the subject line.
- Stage specific files rather than `git add .`
- Run `turbo build` and `turbo test` before pushing.
- Never commit `.env` files, secrets, or API keys.
- Never force-push to shared branches.
