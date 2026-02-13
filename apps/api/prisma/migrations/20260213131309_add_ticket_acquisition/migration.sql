-- CreateEnum
CREATE TYPE "AcquisitionStatus" AS ENUM ('PENDING', 'CARD_CREATED', 'PURCHASING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "TicketAcquisition" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "ticketCount" INTEGER NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "status" "AcquisitionStatus" NOT NULL DEFAULT 'PENDING',
    "stripeCardId" TEXT,
    "cardLast4" TEXT,
    "purchaseUrl" TEXT,
    "confirmationRef" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketAcquisition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TicketAcquisition_eventId_idx" ON "TicketAcquisition"("eventId");

-- CreateIndex
CREATE INDEX "TicketAcquisition_status_idx" ON "TicketAcquisition"("status");

-- AddForeignKey
ALTER TABLE "TicketAcquisition" ADD CONSTRAINT "TicketAcquisition_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
