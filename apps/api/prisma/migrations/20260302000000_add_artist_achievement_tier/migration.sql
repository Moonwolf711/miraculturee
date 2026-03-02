-- Add successfulCampaigns counter to Artist for achievement tier pricing
ALTER TABLE "Artist" ADD COLUMN "successfulCampaigns" INTEGER NOT NULL DEFAULT 0;

-- Backfill from existing data: count campaigns where goalReached = true
UPDATE "Artist" a SET "successfulCampaigns" = (
  SELECT COUNT(*) FROM "Campaign" c WHERE c."artistId" = a.id AND c."goalReached" = true
);
