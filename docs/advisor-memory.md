# Advisor Memory Boundary

Advisor memory is a local, household-scoped evidence store—not a transcript,
prompt cache, prediction system, or cloud synchronization feature.

Each entry has a typed purpose, concise factual summary, source references,
observation time, and optional expiry. Entries may record an explicit user
preference, an annual event, a measured seasonal pattern, or a completed or
dismissed recommendation outcome. It must never store credentials, raw chat
transcripts, account numbers, or inferred sensitive traits.

Memory remains in Wardkeep's local database. No memory entry may be sent to a
cloud model merely because cloud AI is enabled; any future use in an AI request
requires a separate, explicit routing and consent design. Expired entries are
excluded from read APIs and should be pruned by a local maintenance task.
