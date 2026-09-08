# Launch Acceptance Test — One Household Across Mobile and Desktop

Use this test against the deployed **staging** instance before creating a release tag. It verifies that a new household can create meaningful records, understand Wardkeep's readiness output, return to the app on mobile and desktop, and that the deployment is operationally recoverable.

Do not perform a restore against a household database you need to keep. The restore portion belongs on a separate disposable deployment.

## Automated coverage

The repeatable parts of this journey run in CI as `pnpm test:e2e`: registration
and refresh, logout and refresh, mobile navigation anchoring and the More sheet,
desktop sidebar navigation and sticky layout, account/transaction/budget
persistence, and manual-backup listing. The suite starts
`docker-compose.e2e.yml`, which has no persistent volumes and is removed after
the run. CI retains a trace, video, and screenshot when an E2E test fails.

To run it locally after installing Playwright Chromium:

```bash
pnpm exec playwright install chromium
docker compose -f docker-compose.e2e.yml up -d --build
pnpm test:e2e
docker compose -f docker-compose.e2e.yml down -v
```

## Pass condition

The run passes only when every required check passes, no screen shows an unhandled error, and the server checks report healthy containers and an up-to-date migration history. Record the deployed image digest or commit and the device/browser used with the result.

## Preparation

- Use a new, unique test email address. Do not use the shared demo account for this run.
- Have a 12+-character test backup passphrase available. Store it outside Wardkeep until the recovery test is complete.
- Use the same mobile browser and exact URL for the whole run.
- Keep a separate disposable Wardkeep deployment available for the restore test, or mark the recovery portion as pending. Never replace the data on the primary deployment to prove a restore.

On the server, first confirm the deployment itself is healthy:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -i wardkeep
docker exec wardkeep-api node node_modules/prisma/build/index.js migrate status
```

Expected: `wardkeep-api`, `wardkeep-web`, `wardkeep-worker`, Postgres, and Redis are healthy or running as appropriate, and Prisma reports **Database schema is up to date**.

## 1. Mobile access and session persistence — required

1. Open the Wardkeep URL on the phone.
2. Choose **Create account** and register the unique test household.
3. Confirm that the Morning Brief/Home screen loads without an internal-server-error message.
4. Refresh the page twice.
5. Navigate to **Transactions**, **Budget**, **Chat**, and **More**, then return Home.
6. Scroll a long Home screen. The bottom navigation must remain at the bottom of the app viewport and must not drift upward over the content.
7. Choose **More**; close the sheet by tapping its close control and by tapping outside it.
8. Choose **Log out**, refresh once, and confirm that the app remains on Login.
9. Log in again with the same account and refresh once.

Expected: a valid session survives refresh; logout does not; navigation and the More sheet work without content being hidden; no error screen, blank screen, or unexpected login redirect appears.

## 1a. Desktop shell and access — required

1. On a desktop browser at least 1024px wide, log into the same test household.
2. Refresh the Morning Brief page and confirm the session remains active.
3. Use the left sidebar to open **Accounts**, **Transactions**, **Budget**, and **Settings**. Confirm the selected item is visually identified on each page.
4. Scroll a page with enough content to require scrolling. The sidebar must remain pinned to the viewport without covering the content area.
5. Sign out from the sidebar, refresh once, and confirm that Login remains displayed.

Expected: desktop uses the sidebar instead of the mobile bottom navigation; each selected route is clear and usable; the sidebar stays stable while content scrolls; logout removes the session.

## 2. Create a minimal household picture — required

Use clearly recognizable test values so the records are easy to identify later. Do not enter real financial information for a launch test.

1. In **Accounts**, add a manual checking account named `Launch Test Checking` with a recorded balance of `$10,000`.
2. Add a credit-card account named `Launch Test Card`; if offered, record a credit limit and a small balance.
3. In **Income sources**, add `Launch Test Income`, choose a frequency, add an expected net amount, and set a next expected date within the next 30 days.
4. In **Transactions**, add three transactions to the checking account:
   - `Launch groceries` — `$120` expense, categorized as Food & Dining.
   - `Launch utility` — `$80` expense, categorized as Utilities.
   - `Launch one-time repair` — `$500` expense, categorized as Home or Other; mark it as one-time if the workflow offers that control.
5. In **Budget**, allocate a small amount to Food & Dining and Utilities for the current month.
6. In **Cash Flow/Recurring**, add or confirm one recurring obligation with a next date within 30 days.
7. In **Planned expenses**, create one active future expense, then mark it no longer planned and restore it.

Expected: all records persist after navigation and refresh. The transaction list shows the correct account, category, amount, and one-time state. Budget totals update from recorded transactions; planned-expense deactivation and restoration are reversible.

## 3. Readiness, coverage, and action honesty — required

1. Return to the Morning Brief/Home and Dashboard.
2. Open the readiness explanation or pillar detail.
3. Verify that the page distinguishes what Wardkeep evaluated from what remains missing or not evaluated.
4. Open at least one recommendation. Follow its direct link to the relevant workspace.
5. Complete one recommendation and dismiss a different one if both are available; otherwise create enough data for one actionable warning and complete it.
6. Open **Recommendations** and verify that completed or dismissed actions appear in history rather than silently disappearing.
7. Open **Compare readiness**, make one of the available bounded changes, view the comparison, then leave without saving it.
8. Return to Dashboard and confirm the comparison did not change current household records, recommendations, or history.

Expected: Wardkeep presents evaluated evidence, data coverage, and unknowns separately. It does not claim that missing insurance, estate, income-interruption, or other unrecorded information is healthy. A scenario is clearly temporary and does not change the household.

## 4. Financial workflow regression — required

1. In **Transactions**, edit a transaction category, add a tag if available, and mark an unreviewed item reviewed if one exists.
2. In **Rules**, create a narrow test rule for a merchant string that only the test transaction uses; preview it before applying it.
3. Apply the rule and verify only the intended transaction changes. Delete the test rule afterward.
4. In **Debt**, enter a small manual debt profile or use an existing test profile; view a payoff strategy and its month-by-month schedule.
5. In **Financial Overview/Dashboard**, verify the checking balance, recorded spending, and net-worth presentation are internally consistent with the test records.

Expected: preview does not mutate data; applied rule changes only the intended record; debt calculations render a schedule; financial displays use recorded values and disclose limited coverage where relevant.

## 5. Backup and recovery safety — required

1. Open **Settings → Backup & Recovery**.
2. Create a **manual** backup using the test passphrase. Record its timestamp and whether it is labeled manual/portable.
3. Refresh Settings and confirm the new backup appears in the list.
4. Do **not** choose Restore on the primary deployment.
5. On the separate disposable deployment, use the portable manual-backup recovery flow with the same passphrase.
6. After restore, log into the recovered test household and verify `Launch Test Checking`, the three transactions, `Launch Test Income`, and the test budget are present.
7. On the disposable target only, confirm an incorrect passphrase is rejected without replacing data.

Expected: the primary creates and lists an encrypted manual backup; the disposable target can restore it only with the correct passphrase; wrong credentials do not replace target data. Record the recovery result and remove the disposable target when finished.

## 6. Off-site copy — required only when remote backup is in launch scope

1. Confirm both deployments use public HTTPS URLs and that the source has `WARDKEEP_PUBLIC_URL` configured.
2. Create a pairing offer on the destination, then pair from the source using the offer ID and secret.
3. Send the manual backup created above to the destination.
4. Browse copies from the source and confirm the backup's timestamp, size, and recovery class are shown.
5. Revoke the peer and confirm future transfers are blocked while previously stored copies remain listed according to the product contract.

Expected: pairing succeeds only with the supplied offer; stored copies are opaque metadata; revocation stops future access/transfer without silently deleting recovery material.

## 7. Deployment and upgrade verification — required

1. Record the tested commit and image tag/digest.
2. Before an update, create a new manual backup.
3. Pull and deploy the exact tested image using the stack's normal Dockge update process.
4. Confirm the API and worker restart successfully, then re-run the server health and Prisma commands from Preparation.
5. On mobile, log in, refresh, open Home, Transactions, Budget, Settings, and verify the test household remains intact.
6. Review the API logs for the test window. There must be no unhandled exceptions, migration failures, or CORS errors for the deployed web origin.

Expected: the upgrade is forward-only, data persists, migrations are current, and the deployed mobile experience remains usable.

## Result record

Record one result per run:

| Field                                | Record |
| ------------------------------------ | ------ |
| Date/time and tester                 |        |
| Commit, image tag, and image digest  |        |
| Server URL and mobile browser/device |        |
| Sections passed                      |        |
| Sections deferred and reason         |        |
| Defects, logs, or screenshots        |        |
| Final decision: pass / no-go         |        |

Any unhandled exception, unexpected authentication loss, data mutation during a preview/scenario, or failed recovery is a **no-go** until resolved and retested.
