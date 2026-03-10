-- CreateEnum
CREATE TYPE "ManagerPermission" AS ENUM ('READ', 'READ_WRITE');

-- CreateTable
CREATE TABLE "ManagerInvite" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "permission" "ManagerPermission" NOT NULL DEFAULT 'READ_WRITE',
    "email" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistManager" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "ManagerPermission" NOT NULL DEFAULT 'READ_WRITE',
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "profileImageUrl" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtistManager_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerInvite_token_key" ON "ManagerInvite"("token");

-- CreateIndex
CREATE INDEX "ManagerInvite_artistId_idx" ON "ManagerInvite"("artistId");

-- CreateIndex
CREATE INDEX "ManagerInvite_token_idx" ON "ManagerInvite"("token");

-- CreateIndex
CREATE INDEX "ArtistManager_artistId_idx" ON "ArtistManager"("artistId");

-- CreateIndex
CREATE INDEX "ArtistManager_userId_idx" ON "ArtistManager"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistManager_artistId_userId_key" ON "ArtistManager"("artistId", "userId");

-- AddForeignKey
ALTER TABLE "ManagerInvite" ADD CONSTRAINT "ManagerInvite_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistManager" ADD CONSTRAINT "ArtistManager_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistManager" ADD CONSTRAINT "ArtistManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
