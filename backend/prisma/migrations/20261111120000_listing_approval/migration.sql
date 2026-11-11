/*
  Warnings:

  - You are about to drop the column `isAdminApproved` on the `listings` table.
    Nothing ever wrote to it: it was added in the migration before this one and
    is `false` on every row, so there is no data to lose. It is replaced by
    `approval` below, which can say the one thing a boolean could not — whether
    "not approved" means nobody has read it yet, or somebody read it and asked
    for a change.
*/

-- CreateEnum
CREATE TYPE "ListingApproval" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "listings" DROP COLUMN "isAdminApproved",
ADD COLUMN     "approval" "ListingApproval" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approvalDecidedAt" TIMESTAMP(3),
ADD COLUMN     "approvalNote" TEXT;

-- CreateIndex
CREATE INDEX "listings_approval_createdAt_idx" ON "listings"("approval", "createdAt");

-- Backfill. `approval` defaults to PENDING, so without this line every listing
-- already in search arrives in the review queue the moment this is applied —
-- the queue is useless on day one and no seller can reopen a sold listing.
--
-- Anything that is not a DRAFT was published under the old rules, when
-- publishing needed no approval at all. That is a decision this project
-- already made, so it is recorded as one rather than re-litigated per row.
--
-- Existing DRAFTs are deliberately left PENDING: they have genuinely never
-- been read, and from today that is what the queue is for.
UPDATE "listings"
   SET "approval" = 'APPROVED',
       "approvalDecidedAt" = NOW()
 WHERE "status" <> 'DRAFT';
