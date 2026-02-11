-- CreateEnum
CREATE TYPE "ExternalEventStatus" AS ENUM ('DISCOVERED', 'IMPORTED', 'PUBLISHED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "RafflePool" ADD COLUMN     "algorithm" TEXT NOT NULL DEFAULT 'SHA-256 + Fisher-Yates + Seedrandom',
ADD COLUMN     "revealedSeed" TEXT,
ADD COLUMN     "seedHash" TEXT,
ADD COLUMN     "verificationUrl" TEXT;

-- CreateTable
CREATE TABLE "ExternalEvent" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "artistName" TEXT NOT NULL,
    "artistId" TEXT,
    "venueName" TEXT NOT NULL,
    "venueAddress" TEXT NOT NULL,
    "venueCity" TEXT NOT NULL,
    "venueState" TEXT,
    "venueCountry" TEXT NOT NULL,
    "venueLat" DOUBLE PRECISION,
    "venueLng" DOUBLE PRECISION,
    "venueId" TEXT,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "onSaleDate" TIMESTAMP(3),
    "offSaleDate" TIMESTAMP(3),
    "minPriceCents" INTEGER,
    "maxPriceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "genre" TEXT,
    "category" TEXT,
    "status" "ExternalEventStatus" NOT NULL DEFAULT 'DISCOVERED',
    "importedEventId" TEXT,
    "rawData" JSONB NOT NULL,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "eventsFound" INTEGER NOT NULL,
    "eventsNew" INTEGER NOT NULL,
    "eventsUpdated" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuspiciousActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "riskScore" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuspiciousActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalEvent_eventDate_idx" ON "ExternalEvent"("eventDate");

-- CreateIndex
CREATE INDEX "ExternalEvent_venueCity_eventDate_idx" ON "ExternalEvent"("venueCity", "eventDate");

-- CreateIndex
CREATE INDEX "ExternalEvent_status_idx" ON "ExternalEvent"("status");

-- CreateIndex
CREATE INDEX "ExternalEvent_source_idx" ON "ExternalEvent"("source");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalEvent_externalId_source_key" ON "ExternalEvent"("externalId", "source");

-- CreateIndex
CREATE INDEX "EventSyncLog_source_startedAt_idx" ON "EventSyncLog"("source", "startedAt");

-- CreateIndex
CREATE INDEX "SuspiciousActivity_userId_idx" ON "SuspiciousActivity"("userId");

-- CreateIndex
CREATE INDEX "SuspiciousActivity_ip_idx" ON "SuspiciousActivity"("ip");

-- CreateIndex
CREATE INDEX "SuspiciousActivity_type_idx" ON "SuspiciousActivity"("type");

-- CreateIndex
CREATE INDEX "SuspiciousActivity_createdAt_idx" ON "SuspiciousActivity"("createdAt");

-- AddForeignKey
ALTER TABLE "SuspiciousActivity" ADD CONSTRAINT "SuspiciousActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
