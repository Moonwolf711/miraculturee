-- AlterTable: Add price range and source fields to Event
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "maxPriceCents" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "priceSource" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "feesIncluded" BOOLEAN NOT NULL DEFAULT false;
