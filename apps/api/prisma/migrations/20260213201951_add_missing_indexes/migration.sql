-- CreateIndex
CREATE INDEX "Event_artistId_idx" ON "Event"("artistId");

-- CreateIndex
CREATE INDEX "Event_venueCity_date_idx" ON "Event"("venueCity", "date");

-- CreateIndex
CREATE INDEX "PoolTicket_assignedUserId_idx" ON "PoolTicket"("assignedUserId");

-- CreateIndex
CREATE INDEX "RaffleEntry_userId_idx" ON "RaffleEntry"("userId");
