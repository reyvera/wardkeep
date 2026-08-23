#!/usr/bin/env node

/**
 * Records the checked-in Prisma migrations for an existing Wardkeep database
 * without changing its data or schema.
 *
 * This is deliberately conservative: it only proceeds when the live database
 * exactly matches the Prisma schema shipped in this image/revision. A database
 * that is older, newer, or otherwise drifted is left untouched.
 */
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const prisma =
  process.platform === 'win32' ? 'node_modules/.bin/prisma.cmd' : 'node_modules/.bin/prisma';
const schema = 'prisma/schema.prisma';
const migrationsDir = 'prisma/migrations';

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL must be set before baselining migrations.');
  process.exit(1);
}

function run(args) {
  return spawnSync(prisma, args, { encoding: 'utf8', env: process.env });
}

console.log('Verifying that the existing database exactly matches this Wardkeep schema...');
const diff = run([
  'migrate',
  'diff',
  '--exit-code',
  '--from-url',
  process.env.DATABASE_URL,
  '--to-schema-datamodel',
  schema,
]);

if (diff.status !== 0) {
  console.error('ERROR: Database schema does not exactly match this image. Nothing was changed.');
  if (diff.stdout) console.error(diff.stdout.trim());
  if (diff.stderr) console.error(diff.stderr.trim());
  console.error(
    '\nUse the Wardkeep version that last wrote this database to baseline it, then upgrade normally.',
  );
  process.exit(1);
}

const migrations = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (migrations.length === 0) {
  console.error('ERROR: No checked-in migrations were found. Nothing was changed.');
  process.exit(1);
}

console.log(
  `Schema verified. Recording ${migrations.length} existing migration(s) without applying SQL...`,
);
for (const migration of migrations) {
  const result = run(['migrate', 'resolve', '--schema', schema, '--applied', migration]);
  if (result.status !== 0) {
    console.error(`ERROR: Could not record migration ${migration}.`);
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    console.error(
      'No schema or application data was changed; inspect the migration history before retrying.',
    );
    process.exit(1);
  }
}

console.log(
  'Migration history recorded. Future Wardkeep images can use `prisma migrate deploy` safely.',
);
