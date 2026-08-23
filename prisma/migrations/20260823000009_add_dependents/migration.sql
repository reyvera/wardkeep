CREATE TYPE "DependentRelationship" AS ENUM ('CHILD', 'ADULT', 'OTHER');
CREATE TABLE "Dependent" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "label" VARCHAR(100), "relationship" "DependentRelationship" NOT NULL DEFAULT 'OTHER', "reviewDate" DATE, "isActive" BOOLEAN NOT NULL DEFAULT true, "notes" VARCHAR(1000), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Dependent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "Dependent_userId_isActive_idx" ON "Dependent"("userId", "isActive");
CREATE INDEX "Dependent_userId_reviewDate_idx" ON "Dependent"("userId", "reviewDate");
ALTER TABLE "Dependent" ADD CONSTRAINT "Dependent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
