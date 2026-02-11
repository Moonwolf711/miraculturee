-- CreateEnum
CREATE TYPE "DirectTicketStatus" AS ENUM ('PENDING', 'CONFIRMED', 'TRANSFERRED', 'REDEEMED', 'REFUNDED');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'TICKET_PURCHASE';

-- CreateTable
CREATE TABLE "DirectTicket" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "DirectTicketStatus" NOT NULL DEFAULT 'PENDING',
    "priceCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "stripePaymentId" TEXT,
    "ipAddress" TEXT,
    "deviceFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DirectTicket_eventId_idx" ON "DirectTicket"("eventId");

-- CreateIndex
CREATE INDEX "DirectTicket_ownerId_idx" ON "DirectTicket"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectTicket_eventId_ownerId_key" ON "DirectTicket"("eventId", "ownerId");

-- AddForeignKey
ALTER TABLE "DirectTicket" ADD CONSTRAINT "DirectTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectTicket" ADD CONSTRAINT "DirectTicket_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
