-- AlterEnum: Add CREDIT_CONVERSION and CREDIT_SPEND to TransactionType
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CREDIT_CONVERSION';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'CREDIT_SPEND';

-- AlterTable: Add creditsBalanceCents to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "creditsBalanceCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add freeRaffleUsed to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "freeRaffleUsed" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add entryDate to RaffleEntry
ALTER TABLE "RaffleEntry" ADD COLUMN IF NOT EXISTS "entryDate" DATE NOT NULL DEFAULT CURRENT_DATE;

-- DropIndex: Remove old unique constraint (one entry per user per pool)
DROP INDEX IF EXISTS "RaffleEntry_poolId_userId_key";

-- CreateIndex: New unique constraint (one entry per user per pool per day)
CREATE UNIQUE INDEX IF NOT EXISTS "RaffleEntry_poolId_userId_entryDate_key" ON "RaffleEntry"("poolId", "userId", "entryDate");
