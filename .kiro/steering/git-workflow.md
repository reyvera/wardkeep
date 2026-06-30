# Git Workflow

inclusion: auto

## Branch Strategy

- `main` is production-ready. Only receives merges from `develop` at major checkpoints.
- `develop` is the integration branch. Feature branches merge here.
- Feature branches: `feat/<task-group-name>` (e.g., `feat/finance-engine`)
- Bugfix branches: `fix/<short-description>`
- Chore branches: `chore/<short-description>` (deps, config, docs)

## Branch Lifecycle

1. Create feature branch from `develop`: `git checkout -b feat/<name> develop`
2. Implement sub-tasks with one atomic commit per sub-task.
3. After all sub-tasks in the group pass, merge to `develop` with `--no-ff`.
4. Delete the feature branch.
5. At checkpoint tasks (3, 5, 9, 14, 19, 23), merge `develop` into `main` once verified.

## Branch-to-Task Mapping

Each top-level task group gets one feature branch:

| Task Group | Branch |
|---|---|
| 2. Auth & sessions | `feat/auth-sessions` |
| 4. Finance Engine | `feat/finance-engine` |
| 6. Accounts & Transactions | `feat/account-transactions` |
| 7. Categories & Budgets | `feat/category-budgets` |
| 8. Rules Engine | `feat/rules-engine` |
| 10. Importers | `feat/importers` |
| 11. AI Engine | `feat/ai-engine` |
| 12. Worker | `feat/worker` |
| 13. Recurring & Cash-Flow API | `feat/recurring-cashflow` |
| 15. Backup Service | `feat/backup-service` |
| 16. Settings | `feat/settings` |
| 17. Frontend | `feat/frontend` |
| 18. PWA | `feat/pwa` |
| 20. Docker | `feat/docker` |
| 21. Notifications | `feat/notifications` |
| 22. Integration | `feat/integration` |

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
