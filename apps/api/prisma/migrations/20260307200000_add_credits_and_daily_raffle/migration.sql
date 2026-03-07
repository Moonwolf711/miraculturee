-- AlterEnum: Add CREDIT_CONVERSION and CREDIT_SPEND to TransactionType
ALTER TYPE "TransactionType" ADD VALUE 'CREDIT_CONVERSION';
ALTER TYPE "TransactionType" ADD VALUE 'CREDIT_SPEND';

-- AlterTable: Add creditsBalanceCents to User
ALTER TABLE "User" ADD COLUMN "creditsBalanceCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add entryDate to RaffleEntry
ALTER TABLE "RaffleEntry" ADD COLUMN "entryDate" DATE NOT NULL DEFAULT CURRENT_DATE;

-- DropIndex: Remove old unique constraint (one entry per user per pool)
DROP INDEX IF EXISTS "RaffleEntry_poolId_userId_key";

-- CreateIndex: New unique constraint (one entry per user per pool per day)
CREATE UNIQUE INDEX "RaffleEntry_poolId_userId_entryDate_key" ON "RaffleEntry"("poolId", "userId", "entryDate");
