-- AlterTable: Add new profile fields to PromoterAgent
ALTER TABLE "PromoterAgent" ADD COLUMN "headline" TEXT;
ALTER TABLE "PromoterAgent" ADD COLUMN "age" INTEGER;
ALTER TABLE "PromoterAgent" ADD COLUMN "yearsExperience" INTEGER;
ALTER TABLE "PromoterAgent" ADD COLUMN "promoterType" TEXT;
ALTER TABLE "PromoterAgent" ADD COLUMN "genres" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PromoterAgent" ADD COLUMN "skills" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PromoterAgent" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PromoterAgent" ADD COLUMN "profileStrength" INTEGER NOT NULL DEFAULT 0;
