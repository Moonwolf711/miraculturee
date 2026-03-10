-- CreateEnum
CREATE TYPE "PlatformIntegrationStatus" AS ENUM ('NOT_STARTED', 'CONTACTED', 'PENDING_APPROVAL', 'API_KEY_RECEIVED', 'ACTIVE', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "TicketingPlatform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "PlatformIntegrationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "devPortalUrl" TEXT,
    "contactEmail" TEXT,
    "contactedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TicketingPlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformContactLog" (
    "id" TEXT NOT NULL,
    "platformId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentById" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformContactLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TicketingPlatform_name_key" ON "TicketingPlatform"("name");

-- CreateIndex
CREATE INDEX "PlatformContactLog_platformId_idx" ON "PlatformContactLog"("platformId");

-- AddForeignKey
ALTER TABLE "PlatformContactLog" ADD CONSTRAINT "PlatformContactLog_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "TicketingPlatform"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default platforms
INSERT INTO "TicketingPlatform" ("id", "name", "displayName", "devPortalUrl", "contactEmail", "status", "updatedAt") VALUES
  (gen_random_uuid(), 'ticketmaster', 'Ticketmaster', 'https://developer.ticketmaster.com/', 'developer@ticketmaster.com', 'NOT_STARTED', NOW()),
  (gen_random_uuid(), 'eventbrite', 'Eventbrite', 'https://www.eventbrite.com/platform/', 'api@eventbrite.com', 'NOT_STARTED', NOW()),
  (gen_random_uuid(), 'axs', 'AXS', 'https://developer.axs.com/', NULL, 'NOT_STARTED', NOW()),
  (gen_random_uuid(), 'dice', 'DICE', 'https://dice.fm/', NULL, 'NOT_STARTED', NOW()),
  (gen_random_uuid(), 'seetickets', 'See Tickets', 'https://www.seetickets.com/', NULL, 'NOT_STARTED', NOW()),
  (gen_random_uuid(), 'universe', 'Universe', 'https://www.universe.com/api', NULL, 'NOT_STARTED', NOW());
