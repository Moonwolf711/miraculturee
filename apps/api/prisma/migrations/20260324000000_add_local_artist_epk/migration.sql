-- CreateTable
CREATE TABLE "LocalArtistProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stageName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "bio" TEXT,
    "profileImageUrl" TEXT,
    "bannerImageUrl" TEXT,
    "genres" TEXT[],
    "instruments" TEXT[],
    "professionalType" TEXT,
    "yearsActive" INTEGER,
    "bookingEmail" TEXT,
    "bookingRate" TEXT,
    "availableForBooking" BOOLEAN NOT NULL DEFAULT true,
    "epkUrl" TEXT,
    "socialLinks" JSONB,
    "followerCount" JSONB,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "profileStrength" INTEGER NOT NULL DEFAULT 0,
    "totalShows" INTEGER NOT NULL DEFAULT 0,
    "totalTicketsSold" INTEGER NOT NULL DEFAULT 0,
    "avgTicketsPerShow" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastBookedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalArtistProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalArtistRelease" (
    "id" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "platform" TEXT,
    "url" TEXT,
    "releaseDate" TIMESTAMP(3),
    "streamCount" INTEGER,
    "coverImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalArtistRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalArtistShow" (
    "id" TEXT NOT NULL,
    "artistProfileId" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "venueCity" TEXT NOT NULL,
    "eventTitle" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "role" TEXT NOT NULL,
    "ticketsSold" INTEGER,
    "totalAttendance" INTEGER,
    "promoterName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalArtistShow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingRequest" (
    "id" TEXT NOT NULL,
    "localArtistId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "eventTitle" TEXT NOT NULL,
    "venueName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "offeredRole" TEXT NOT NULL,
    "compensation" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LocalArtistProfile_userId_key" ON "LocalArtistProfile"("userId");

-- CreateIndex
CREATE INDEX "LocalArtistProfile_city_state_idx" ON "LocalArtistProfile"("city", "state");

-- CreateIndex
CREATE INDEX "LocalArtistProfile_state_idx" ON "LocalArtistProfile"("state");

-- CreateIndex
CREATE INDEX "LocalArtistProfile_availableForBooking_idx" ON "LocalArtistProfile"("availableForBooking");

-- CreateIndex
CREATE INDEX "LocalArtistRelease_artistProfileId_idx" ON "LocalArtistRelease"("artistProfileId");

-- CreateIndex
CREATE INDEX "LocalArtistShow_artistProfileId_date_idx" ON "LocalArtistShow"("artistProfileId", "date");

-- CreateIndex
CREATE INDEX "BookingRequest_localArtistId_status_idx" ON "BookingRequest"("localArtistId", "status");

-- CreateIndex
CREATE INDEX "BookingRequest_requesterId_idx" ON "BookingRequest"("requesterId");

-- AddForeignKey
ALTER TABLE "LocalArtistProfile" ADD CONSTRAINT "LocalArtistProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalArtistRelease" ADD CONSTRAINT "LocalArtistRelease_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "LocalArtistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalArtistShow" ADD CONSTRAINT "LocalArtistShow_artistProfileId_fkey" FOREIGN KEY ("artistProfileId") REFERENCES "LocalArtistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_localArtistId_fkey" FOREIGN KEY ("localArtistId") REFERENCES "LocalArtistProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
