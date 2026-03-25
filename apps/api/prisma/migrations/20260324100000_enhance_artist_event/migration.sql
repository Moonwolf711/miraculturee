-- AlterTable: Add rich profile fields to Artist
ALTER TABLE "Artist" ADD COLUMN "profileImageUrl" TEXT;
ALTER TABLE "Artist" ADD COLUMN "bannerImageUrl" TEXT;
ALTER TABLE "Artist" ADD COLUMN "city" TEXT;
ALTER TABLE "Artist" ADD COLUMN "state" TEXT;
ALTER TABLE "Artist" ADD COLUMN "websiteUrl" TEXT;
ALTER TABLE "Artist" ADD COLUMN "genres" TEXT[] DEFAULT '{}';
ALTER TABLE "Artist" ADD COLUMN "instruments" TEXT[] DEFAULT '{}';
ALTER TABLE "Artist" ADD COLUMN "professionalType" TEXT;
ALTER TABLE "Artist" ADD COLUMN "yearsActive" INTEGER;
ALTER TABLE "Artist" ADD COLUMN "hometown" TEXT;
ALTER TABLE "Artist" ADD COLUMN "socialLinks" JSONB;
ALTER TABLE "Artist" ADD COLUMN "followerCount" JSONB;
ALTER TABLE "Artist" ADD COLUMN "profileStrength" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add media fields to Event
ALTER TABLE "Event" ADD COLUMN "flyerImageUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN "flyerImage2Url" TEXT;
ALTER TABLE "Event" ADD COLUMN "promoVideoUrl" TEXT;
ALTER TABLE "Event" ADD COLUMN "eventSocialLinks" JSONB;
ALTER TABLE "Event" ADD COLUMN "eventHashtag" TEXT;
ALTER TABLE "Event" ADD COLUMN "lineupNotes" TEXT;
