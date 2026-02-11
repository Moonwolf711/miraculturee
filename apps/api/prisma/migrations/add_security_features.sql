-- Add cryptographic commitment fields to RafflePool
ALTER TABLE "RafflePool" ADD COLUMN "seedHash" TEXT;
ALTER TABLE "RafflePool" ADD COLUMN "revealedSeed" TEXT;
ALTER TABLE "RafflePool" ADD COLUMN "algorithm" TEXT NOT NULL DEFAULT 'SHA-256 + Fisher-Yates + Seedrandom';
ALTER TABLE "RafflePool" ADD COLUMN "verificationUrl" TEXT;

-- Create SuspiciousActivity table
CREATE TABLE "SuspiciousActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "riskScore" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuspiciousActivity_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "SuspiciousActivity_userId_idx" ON "SuspiciousActivity"("userId");
CREATE INDEX "SuspiciousActivity_ip_idx" ON "SuspiciousActivity"("ip");
CREATE INDEX "SuspiciousActivity_type_idx" ON "SuspiciousActivity"("type");
CREATE INDEX "SuspiciousActivity_createdAt_idx" ON "SuspiciousActivity"("createdAt");

-- Add foreign key
ALTER TABLE "SuspiciousActivity" ADD CONSTRAINT "SuspiciousActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
