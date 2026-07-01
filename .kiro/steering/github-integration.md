# GitHub Integration

inclusion: auto

## Commit Messages and Issue References

When committing work that relates to a GitHub issue or roadmap feature, include the issue reference in the commit message body or use keywords that the sync script can match:

- Use `closes #N` or `fixes #N` in commit messages when you know the issue number
- The automated sync script (`scripts/sync-tasks-to-github.sh`) matches commit messages to open issues by keyword

## After Completing Work

After completing a feature or fix:
1. Update `tasks.md` status (mark as `[x]`)
2. Commit with a descriptive message matching the feature name
3. The agentStop hook will attempt to close matching GitHub issues

## When Creating New Tasks

When the user requests a new feature to be logged:
1. Add it to `tasks.md` under Future Features
2. If gh CLI is available, also create a GitHub issue with appropriate labels and milestone
