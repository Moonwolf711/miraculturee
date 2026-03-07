-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'DEVELOPER';

-- CreateEnum
CREATE TYPE "DeveloperInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeveloperPermission" AS ENUM ('FULL', 'LIMITED');

-- CreateTable
CREATE TABLE "DeveloperInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "DeveloperInviteStatus" NOT NULL DEFAULT 'PENDING',
    "permission" "DeveloperPermission" NOT NULL DEFAULT 'LIMITED',
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperInvite_token_key" ON "DeveloperInvite"("token");

-- CreateIndex
CREATE INDEX "DeveloperInvite_email_idx" ON "DeveloperInvite"("email");

-- CreateIndex
CREATE INDEX "DeveloperInvite_status_idx" ON "DeveloperInvite"("status");

-- AddForeignKey
ALTER TABLE "DeveloperInvite" ADD CONSTRAINT "DeveloperInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperInvite" ADD CONSTRAINT "DeveloperInvite_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
