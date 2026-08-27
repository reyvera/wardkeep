CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nickname" VARCHAR(100),
  "make" VARCHAR(80) NOT NULL,
  "model" VARCHAR(80) NOT NULL,
  "year" INTEGER,
  "mileage" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VehicleMaintenance" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "dueDate" DATE,
  "dueMileage" INTEGER,
  "completedAt" DATE,
  "completedMileage" INTEGER,
  "estimatedCost" DECIMAL(19,4),
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleMaintenance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Vehicle_userId_isActive_idx" ON "Vehicle"("userId", "isActive");
CREATE INDEX "VehicleMaintenance_vehicleId_dueDate_idx" ON "VehicleMaintenance"("vehicleId", "dueDate");
CREATE INDEX "VehicleMaintenance_vehicleId_completedAt_idx" ON "VehicleMaintenance"("vehicleId", "completedAt");

ALTER TABLE "Vehicle"
  ADD CONSTRAINT "Vehicle_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleMaintenance"
  ADD CONSTRAINT "VehicleMaintenance_vehicleId_fkey"
  FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
