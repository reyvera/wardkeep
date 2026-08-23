# GitHub Integration

inclusion: auto

## Commit Messages and Issue References

When committing work that completes a GitHub issue, include an explicit closing reference in the commit message body:

- Use `Closes #N`, `Fixes #N`, or `Resolves #N` only when the work is genuinely complete.
- Plain `#N` references are informational and do not change issue status.
- `scripts/sync-tasks-to-github.sh` is report-only by default. Run it with `--close` only after the referenced commit is verified on the remote.

## After Completing Work

After completing a feature or fix:
1. Update `tasks.md` status (mark as `[x]`)
2. Commit with an explicit `Closes #N` reference when applicable
3. Verify the commit is on the remote, then deliberately close or update the explicitly referenced issue and Project status

## When Creating New Tasks

When the user requests a new feature to be logged:
1. Add it to `tasks.md` under Future Features
2. If gh CLI is available, also create a GitHub issue with appropriate labels and milestone
