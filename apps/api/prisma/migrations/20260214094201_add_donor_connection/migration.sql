-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'LOCAL_TICKET';

-- AlterTable
ALTER TABLE "Campaign" ADD COLUMN     "bonusCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountCents" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "fundedCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "goalCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "goalReached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "goalReachedAt" TIMESTAMP(3),
ADD COLUMN     "maxLocalTickets" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "DonorConnection" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "donorUserId" TEXT NOT NULL,
    "receiverUserId" TEXT,
    "donorSocials" JSONB,
    "receiverChoice" TEXT,
    "receiverSocials" JSONB,
    "thankYouMessage" TEXT,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonorConnection_eventId_matched_idx" ON "DonorConnection"("eventId", "matched");

-- CreateIndex
CREATE INDEX "DonorConnection_donorUserId_idx" ON "DonorConnection"("donorUserId");

-- CreateIndex
CREATE INDEX "DonorConnection_receiverUserId_idx" ON "DonorConnection"("receiverUserId");

-- AddForeignKey
ALTER TABLE "DonorConnection" ADD CONSTRAINT "DonorConnection_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
