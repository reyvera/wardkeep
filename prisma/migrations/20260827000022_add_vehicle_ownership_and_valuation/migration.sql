CREATE TYPE "VehicleKind" AS ENUM ('AUTOMOBILE', 'MOTORCYCLE', 'RV', 'BOAT', 'TRAILER', 'ATV', 'OTHER');
CREATE TYPE "VehicleOwnership" AS ENUM ('OWNED', 'FINANCED', 'LEASED', 'OTHER');

ALTER TABLE "Vehicle"
  ADD COLUMN "kind" "VehicleKind" NOT NULL DEFAULT 'AUTOMOBILE',
  ADD COLUMN "ownership" "VehicleOwnership" NOT NULL DEFAULT 'OWNED',
  ADD COLUMN "vin" VARCHAR(17),
  ADD COLUMN "loanBalance" DECIMAL(19,4),
  ADD COLUMN "leasePayment" DECIMAL(19,4),
  ADD COLUMN "leaseEndDate" DATE,
  ADD COLUMN "leaseMileageAllowance" INTEGER,
  ADD COLUMN "estimatedValue" DECIMAL(19,4),
  ADD COLUMN "valuationSource" VARCHAR(80),
  ADD COLUMN "valuedAt" DATE;
