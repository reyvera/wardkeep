import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = JSON.parse(readFileSync('package.json', 'utf8'));
const manifests = ['package.json'];
for (const directory of ['apps', 'packages']) {
  for (const name of readdirSync(directory)) manifests.push(join(directory, name, 'package.json'));
}
const mismatches = manifests.filter((file) => JSON.parse(readFileSync(file, 'utf8')).version !== root.version);
if (mismatches.length) throw new Error(`Workspace versions must match ${root.version}: ${mismatches.join(', ')}`);

const tag = process.env.RELEASE_TAG;
if (tag?.startsWith('v') && tag.slice(1) !== root.version) {
  throw new Error(`Release tag ${tag} does not match package version ${root.version}`);
}
console.log(`Release version check passed: ${root.version}${tag ? ` (${tag})` : ''}`);
