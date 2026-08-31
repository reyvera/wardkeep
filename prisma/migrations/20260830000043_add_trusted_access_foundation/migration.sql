CREATE TYPE "TrustedAccessInvitationStatus" AS ENUM ('PENDING', 'APPROVED', 'REVOKED', 'EXPIRED');

CREATE TABLE "TrustedAccessInvitation" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "recipientEmail" VARCHAR(254) NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "status" "TrustedAccessInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "approvedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrustedAccessInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrustedAccessInvitation_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "TrustedAccessInvitation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrustedAccessInvitation_ownerUserId_status_idx" ON "TrustedAccessInvitation"("ownerUserId", "status");
CREATE INDEX "TrustedAccessInvitation_recipientEmail_status_idx" ON "TrustedAccessInvitation"("recipientEmail", "status");

CREATE TABLE "TrustedAccessGrant" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrustedAccessGrant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrustedAccessGrant_ownerUserId_recipientUserId_key" UNIQUE ("ownerUserId", "recipientUserId"),
  CONSTRAINT "TrustedAccessGrant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrustedAccessGrant_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrustedAccessGrant_recipientUserId_isActive_idx" ON "TrustedAccessGrant"("recipientUserId", "isActive");

CREATE TABLE "TrustedAccessAuditEvent" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT,
  "grantId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "event" VARCHAR(80) NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TrustedAccessAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrustedAccessAuditEvent_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "TrustedAccessInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TrustedAccessAuditEvent_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "TrustedAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TrustedAccessAuditEvent_invitationId_createdAt_idx" ON "TrustedAccessAuditEvent"("invitationId", "createdAt");
CREATE INDEX "TrustedAccessAuditEvent_grantId_createdAt_idx" ON "TrustedAccessAuditEvent"("grantId", "createdAt");
