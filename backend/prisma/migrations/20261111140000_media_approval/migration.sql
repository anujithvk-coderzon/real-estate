-- Approval moves from the listing onto each photograph and the video.
--
-- 20261111120000_listing_approval added approval/approvalNote/approvalDecidedAt
-- to "listings". They are dropped again at the bottom of this file. The DROPs
-- are guarded with IF EXISTS so this applies cleanly whether that migration has
-- already run or is still pending: `migrate deploy` applies them in order
-- either way, and the end state is the same.
--
-- Nothing is lost. Those columns were never written to by a running server.

-- AlterTable
ALTER TABLE "listing_images" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
                             ADD COLUMN     "reviewNote" TEXT;

-- AlterTable
ALTER TABLE "listing_videos" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT false,
                             ADD COLUMN     "reviewNote" TEXT;

-- DropIndex
-- Replaced by the composite below, which keeps listingId as its leading column
-- and so still serves every lookup and count that used this one.
DROP INDEX IF EXISTS "listing_images_listingId_idx";

-- CreateIndex
CREATE INDEX "listing_images_listingId_approved_position_idx" ON "listing_images"("listingId", "approved", "position");

-- Backfill, and it is not optional: `approved` defaults to false, so without
-- these two statements every photograph on every listing already in search
-- disappears the moment this is applied. Thousands of live listings go blank
-- at once and the only way back is an operator opening each one.
--
-- Anything on a listing that is not a DRAFT is already public today. It was
-- published under rules that asked for no audit at all, which is a decision
-- this project has already made and is not re-made per row here.
--
-- Media on drafts stays false: those listings have never been read, and from
-- today that is exactly what the queue is for.
UPDATE "listing_images"
   SET "approved" = true
 WHERE "listingId" IN (SELECT "id" FROM "listings" WHERE "status" <> 'DRAFT');

UPDATE "listing_videos"
   SET "approved" = true
 WHERE "listingId" IN (SELECT "id" FROM "listings" WHERE "status" <> 'DRAFT');

-- And now the listing-level copy goes. Two sources of truth for "may buyers
-- see this" is one more than the number that can be kept correct.
DROP INDEX IF EXISTS "listings_approval_createdAt_idx";

ALTER TABLE "listings" DROP COLUMN IF EXISTS "approval",
                       DROP COLUMN IF EXISTS "approvalNote",
                       DROP COLUMN IF EXISTS "approvalDecidedAt";

DROP TYPE IF EXISTS "ListingApproval";
