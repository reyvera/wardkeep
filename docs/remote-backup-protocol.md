# Remote Backup Protocol (Design)

Status: protocol design, peer/blob metadata, pairing-offer, replay-nonce,
idempotent outbound pairing route, authenticated push/list/download routes,
and verified opaque-storage foundations are complete. Settings provides pairing,
manual transfer, remote-copy browsing, and explicit restore after a checksum
verification. Outbound pairing also requires a validated `WARDKEEP_PUBLIC_URL`
deployment setting. Per-destination automatic encrypted copies can run hourly,
every six hours, daily, or weekly. An authenticated hourly health check marks a
peer unreachable after three failures and restores it automatically when it
responds. Fresh-instance bootstrap remains pending.

## Purpose and boundary

Remote backup gives a Wardkeep deployment an optional off-site location for an
already encrypted backup blob. The receiving Wardkeep deployment is an opaque
store: it cannot read, index, score, recommend from, or merge the household
data it receives.

This protocol is not a general cross-deployment import/export feature. It does
not rebind user IDs, merge households, move bank connections, or grant trusted
access. Remote restore is an explicit local replacement after archive validation;
it is not an in-place remote import.

## Recovery classes

| Recovery class                    | What is stored remotely                                                                   | Where it can be restored                            | Key requirement                                                             |
| --------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Same-deployment off-site recovery | An automated backup encrypted with the source deployment's protected scheduled-backup key | The source deployment after a local data-loss event | The source deployment retains its `ENCRYPTION_KEY` and scheduled-backup key |
| Portable off-site recovery        | A manual backup encrypted with a household-selected recovery passphrase                   | A fresh or replacement deployment                   | The household has the passphrase                                            |

An automated backup must never be advertised as portable. Its encryption key
is intentionally tied to its source deployment. Portable recovery requires a
manual recovery passphrase; Wardkeep must not persist that passphrase or send
it to the peer.

## Pairing model

Pairing is explicit and one time:

1. The receiving deployment creates a pairing offer with a random 256-bit
   secret, an opaque offer ID, a 15-minute expiry, permitted direction, and an
   optional human-readable peer name.
2. The operator transfers the offer to the sending deployment through a trusted
   channel and confirms the receiving HTTPS URL and displayed certificate
   identity. The sending deployment must have `WARDKEEP_PUBLIC_URL` set to its
   own externally reachable HTTPS origin before it can begin pairing.
3. The sending deployment redeems the offer once. Both deployments create a
   peer record containing a distinct peer ID, the negotiated secret encrypted
   at rest, endpoint URL, direction, status, and timestamps.
4. The receiver consumes the offer atomically. Reuse, expiration, revocation,
   and an endpoint mismatch fail closed and are audited.

If a receiver commits pairing but its response is lost, the sender may retry
the same redemption. The receiver returns the original pairing only when the
peer ID, endpoint, name, direction, and secret all match; a retry cannot alter
an established peer or reveal its encrypted secret material.

Pairing does not copy any backup and does not create a household membership,
trusted-access grant, or user account on the peer.

## Request authentication

Every peer request uses a versioned HMAC envelope. The secret is never sent as
a request value.

Headers:

```text
X-Wardkeep-Peer: <peer-id>
X-Wardkeep-Timestamp: <UTC ISO-8601 timestamp>
X-Wardkeep-Nonce: <random 128-bit nonce>
X-Wardkeep-Content-SHA256: <hex digest of raw body>
X-Wardkeep-Signature: v1=<base64url HMAC-SHA-256>
```

The signature input is the exact newline-separated string:

```text
v1\n<METHOD>\n<PATH>\n<TIMESTAMP>\n<NONCE>\n<CONTENT-SHA256>
```

The receiver verifies the peer status, HTTPS transport, a five-minute clock
window, body digest, and signature before touching storage. It atomically
records the nonce for the validity window; a repeated nonce is rejected. Error
responses never identify whether a peer ID, secret, or backup ID was valid.

## Opaque backup storage

The receiver accepts only a bounded-size binary blob plus non-secret metadata:
protocol version, sender backup ID, size, SHA-256 digest, creation time, and
recovery class. It recomputes the digest while streaming to a temporary
0600-permission file, then atomically renames the verified file into that
peer's storage directory.

Metadata is scoped to both the receiving owner and the peer. A peer can list or
pull only its own records. Retention is bounded per peer (default ten blobs),
with deletion only after a newly received blob is verified and recorded.

The receiver must reject unexpected content type, a mismatched digest,
duplicate sender backup IDs with different digests, truncated bodies, and files
over the configured maximum. It must never decrypt an incoming blob.

## Endpoint contract

The eventual endpoints are private peer APIs, not browser workflows:

| Endpoint                                                   | Purpose                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------- |
| `POST /api/remote-backup/pair/offers`                      | Create a short-lived pairing offer on the receiver                         |
| `POST /api/remote-backup/pair/connect`                     | Authenticated sender workflow; persists/retries one pending pairing safely |
| `POST /api/remote-backup/pair/redeem`                      | Redeem an offer once from the sender                                       |
| `GET /api/remote-backup/peers`                             | List the authenticated household's non-secret peer status                  |
| `POST /api/remote-backup/peers/:id/revoke`                 | Disable a peer while retaining its opaque blobs                            |
| `POST /api/remote-backup/peers/:id/backups/:backupId/push` | Stream one selected local encrypted archive to a paired peer               |
| `POST /api/remote-backup/blobs`                            | Stream one encrypted blob to the receiver                                  |
| `GET /api/remote-backup/blobs`                             | List authenticated peer-scoped metadata only                               |
| `GET /api/remote-backup/blobs/:id`                         | Stream the unchanged encrypted blob to its authenticated peer              |
| `GET /api/remote-backup/health`                            | Authenticated liveness check with no household data                        |

Pairing uses a separately authenticated offer exchange; all later endpoints
require the HMAC envelope. Browser authentication must never substitute for
peer authentication.

## Transport and network controls

- Peer URLs must be absolute HTTPS URLs, with no userinfo, fragment, or
  redirect following.
- `WARDKEEP_PUBLIC_URL` is optional unless a deployment initiates pairing. When
  set, it must meet the same public-HTTPS-origin and DNS safety checks as a
  peer URL; local and private-network addresses are not supported initially.
- By default, URLs resolving to loopback, link-local, private, multicast, or
  unspecified addresses are rejected to reduce server-side request forgery.
  A documented deployment-only override may allow a verified private LAN peer.
- DNS is resolved and checked immediately before each outbound connection; the
  HTTP client connects to the validated address rather than resolving the host
  again, and it must not follow redirects.
- Pairing, push, pull, revoke, and health actions are rate limited, audited,
  and use strict request/body timeouts.
- Peer secrets are encrypted using the deployment `ENCRYPTION_KEY`, excluded
  from local household backups, redacted from logs, and never returned by the
  API after pairing.

## Restore flow

1. A deployment lists only its paired peer's backup metadata.
2. It fetches the selected opaque blob over the authenticated peer channel and
   verifies the digest before making it eligible for restore.
3. The existing local restore code decrypts and validates the archive before
   changing household records.
4. Wardkeep shows the recovery class. A source-tied automated blob can restore
   only on its source deployment; a portable manual blob requires the user's
   recovery passphrase.

There is no in-place “remote import” and no automatic restore. Destructive
replacement remains an explicit local confirmation after archive validation.

### Fresh-instance recovery pairing

A manual backup passphrase decrypts an archive but must not authenticate a new
deployment to a peer. Existing peer IDs and HMAC secrets intentionally stay on
the original deployment, so a replacement instance cannot list a departed
peer's opaque blobs merely by knowing the passphrase.

Fresh-instance recovery therefore requires a separate, receiver-created,
single-use recovery offer. The operator selects one stored portable-manual
archive on the receiver and transfers its opaque recovery offer to the new
deployment through a secure channel. The offer contains a high-entropy secret,
expires in 15 minutes, is hashed at rest, and is scoped to exactly one archive.
Redeeming it creates a short-lived recovery session that may download that
archive once over HTTPS. It cannot list other blobs,
upload data, pair a regular peer, or access source-tied automated archives.

The new deployment verifies the download digest, asks for the manual recovery
passphrase locally, validates the archive before any write, and invalidates the
recovery session after the download attempt. The receiver audits offer creation,
redemption, and archive download without recording the secret or passphrase;
expiry/revocation reporting and the replacement-instance restore UI remain
follow-up work.

## Required implementation gates

- HMAC, nonce replay, expiry, body-digest, SSRF, retention, and revocation unit
  tests.
- Two-deployment integration test: pair, push an encrypted blob, list, pull,
  verify digest, and prove the receiver never decrypts it.
- Recovery test for same-deployment source-tied backups and a separate fresh
  deployment test for a manual passphrase backup.
- Authorization-isolation test proving one peer cannot list, pull, overwrite,
  or delete another peer's blobs.
- Operator documentation covering key retention, passphrase custody, network
  exposure, and a periodic recovery drill.
