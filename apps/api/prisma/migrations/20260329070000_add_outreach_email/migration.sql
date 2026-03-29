-- CreateTable
CREATE TABLE "OutreachEmail" (
    "id" TEXT NOT NULL,
    "resendId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "subject" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "opens" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "OutreachEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutreachEmail_resendId_key" ON "OutreachEmail"("resendId");
CREATE INDEX "OutreachEmail_email_idx" ON "OutreachEmail"("email");
CREATE INDEX "OutreachEmail_status_idx" ON "OutreachEmail"("status");
