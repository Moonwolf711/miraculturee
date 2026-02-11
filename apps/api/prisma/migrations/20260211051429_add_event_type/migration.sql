-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('SHOW', 'FESTIVAL');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "type" "EventType" NOT NULL DEFAULT 'SHOW';
