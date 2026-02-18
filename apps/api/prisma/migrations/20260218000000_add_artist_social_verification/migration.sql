-- CreateEnum
CREATE TYPE "SocialProvider" AS ENUM ('SPOTIFY', 'SOUNDCLOUD', 'INSTAGRAM', 'FACEBOOK');

-- AlterTable: Add verification fields to Artist
ALTER TABLE "Artist" ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Artist" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Artist" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED';

-- CreateTable
CREATE TABLE "ArtistSocialAccount" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "provider" "SocialProvider" NOT NULL,
    "providerUserId" TEXT NOT NULL,
    "providerUsername" TEXT,
    "profileUrl" TEXT,
    "followerCount" INTEGER,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "rawProfile" JSONB,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" TIMESTAMP(3),

    CONSTRAINT "ArtistSocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArtistSocialAccount_artistId_idx" ON "ArtistSocialAccount"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistSocialAccount_artistId_provider_key" ON "ArtistSocialAccount"("artistId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistSocialAccount_provider_providerUserId_key" ON "ArtistSocialAccount"("provider", "providerUserId");

-- AddForeignKey
ALTER TABLE "ArtistSocialAccount" ADD CONSTRAINT "ArtistSocialAccount_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
