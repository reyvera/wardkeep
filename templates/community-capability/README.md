# Community Capability template

Copy this directory, then rename the capability ID and class. Keep the manifest and metadata aligned.

Structure:

- `capability.manifest.json` — identity, SDK compatibility, pillar mapping, and declared package dependencies.
- `src/index.ts` — the `Capability` implementation.

Capabilities receive only `CapabilityContext`, which contains a household ID and evaluation time. They must scope their own data access to that household and publish observations and signals rather than exposing raw records to other capabilities. Community packages are not executable or installable yet; marketplace installation will add sandbox and permission checks in the next phase.
