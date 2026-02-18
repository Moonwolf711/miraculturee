-- AlterEnum: Add AWAITING_ARTIST to EventStatus
ALTER TYPE "EventStatus" ADD VALUE 'AWAITING_ARTIST';

-- AlterTable: Add isPlaceholder and spotifyArtistId to Artist
ALTER TABLE "Artist" ADD COLUMN "isPlaceholder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Artist" ADD COLUMN "spotifyArtistId" TEXT;

-- CreateIndex: unique constraint on spotifyArtistId
CREATE UNIQUE INDEX "Artist_spotifyArtistId_key" ON "Artist"("spotifyArtistId");

-- CreateTable: ShareInvite
CREATE TABLE "ShareInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "fanUserId" TEXT,
    "shareToken" TEXT NOT NULL,
    "platform" TEXT,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareInvite_shareToken_key" ON "ShareInvite"("shareToken");
CREATE INDEX "ShareInvite_eventId_idx" ON "ShareInvite"("eventId");

-- AddForeignKey
ALTER TABLE "ShareInvite" ADD CONSTRAINT "ShareInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: Mark existing placeholder artists
UPDATE "Artist" SET "isPlaceholder" = true
WHERE "userId" IN (
    SELECT "id" FROM "User"
    WHERE "email" LIKE '%@system.miraculture.com'
);
