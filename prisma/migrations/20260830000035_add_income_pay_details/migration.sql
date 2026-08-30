CREATE TYPE "EmploymentPayType" AS ENUM ('SALARY', 'HOURLY', 'OTHER');
ALTER TABLE "IncomeSource" ADD COLUMN "employmentPayType" "EmploymentPayType", ADD COLUMN "hourlyRate" DECIMAL(19,4), ADD COLUMN "typicalHoursPerPayPeriod" DECIMAL(9,2);
