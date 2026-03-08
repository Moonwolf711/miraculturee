-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'AGENT';

-- CreateEnum
CREATE TYPE "AgentVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "PromoterAgent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "state" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "venueExperience" TEXT,
    "promotionHistory" TEXT,
    "socialLinks" JSONB,
    "verificationStatus" "AgentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNote" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revenueSharePct" INTEGER NOT NULL DEFAULT 50,
    "totalCampaigns" INTEGER NOT NULL DEFAULT 0,
    "totalEarnedCents" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoterAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCampaign" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "revenueSharePct" INTEGER NOT NULL DEFAULT 50,
    "earnedCents" INTEGER NOT NULL DEFAULT 0,
    "paidOut" BOOLEAN NOT NULL DEFAULT false,
    "artistRating" INTEGER,
    "artistReview" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoterAgent_userId_key" ON "PromoterAgent"("userId");
CREATE INDEX "PromoterAgent_state_idx" ON "PromoterAgent"("state");
CREATE INDEX "PromoterAgent_verificationStatus_idx" ON "PromoterAgent"("verificationStatus");
CREATE INDEX "PromoterAgent_state_verificationStatus_idx" ON "PromoterAgent"("state", "verificationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCampaign_campaignId_key" ON "AgentCampaign"("campaignId");
CREATE INDEX "AgentCampaign_agentId_idx" ON "AgentCampaign"("agentId");
CREATE INDEX "AgentCampaign_campaignId_idx" ON "AgentCampaign"("campaignId");

-- AddForeignKey
ALTER TABLE "PromoterAgent" ADD CONSTRAINT "PromoterAgent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCampaign" ADD CONSTRAINT "AgentCampaign_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "PromoterAgent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentCampaign" ADD CONSTRAINT "AgentCampaign_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
