CREATE TABLE "CapabilitySetting" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "capabilityId" VARCHAR(100) NOT NULL,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CapabilitySetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CapabilitySetting_userId_capabilityId_key" ON "CapabilitySetting"("userId", "capabilityId");
CREATE INDEX "CapabilitySetting_userId_isEnabled_idx" ON "CapabilitySetting"("userId", "isEnabled");

ALTER TABLE "CapabilitySetting" ADD CONSTRAINT "CapabilitySetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
