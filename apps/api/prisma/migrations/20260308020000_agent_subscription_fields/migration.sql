-- AlterEnum: Add agent transaction types
ALTER TYPE "TransactionType" ADD VALUE 'AGENT_RAFFLE_CREDIT';
ALTER TYPE "TransactionType" ADD VALUE 'AGENT_CREDIT_SPEND';

-- AlterTable: Add subscription and raffle credit fields to PromoterAgent
ALTER TABLE "PromoterAgent" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "PromoterAgent" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "PromoterAgent" ADD COLUMN "subscriptionStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "PromoterAgent" ADD COLUMN "subscriptionEndAt" TIMESTAMP(3);
ALTER TABLE "PromoterAgent" ADD COLUMN "raffleCreditCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PromoterAgent" ADD COLUMN "creditResetAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "PromoterAgent_stripeCustomerId_key" ON "PromoterAgent"("stripeCustomerId");
CREATE UNIQUE INDEX "PromoterAgent_stripeSubscriptionId_key" ON "PromoterAgent"("stripeSubscriptionId");
