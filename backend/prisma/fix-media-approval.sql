-- One-off repair for production, where 20261111140000_media_approval failed
-- because "listing_images"."approved" already existed (added outside
-- migrations). This finishes the rest of that migration without its backfill
-- over existing data, so photo approvals already made are kept as they are.
-- Safe to run more than once. Delete this file once production is fixed.
--
--   npx prisma db execute --file prisma/fix-media-approval.sql
--   npx prisma migrate resolve --applied 20261111140000_media_approval

BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'listing_images' AND column_name = 'approved') THEN
    ALTER TABLE "listing_images" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "listing_images" SET "approved" = true
     WHERE "listingId" IN (SELECT "id" FROM "listings" WHERE "status" <> 'DRAFT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'listing_videos' AND column_name = 'approved') THEN
    ALTER TABLE "listing_videos" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "listing_videos" SET "approved" = true
     WHERE "listingId" IN (SELECT "id" FROM "listings" WHERE "status" <> 'DRAFT');
  END IF;
END $$;

ALTER TABLE "listing_images" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;
ALTER TABLE "listing_videos" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

DROP INDEX IF EXISTS "listing_images_listingId_idx";
CREATE INDEX IF NOT EXISTS "listing_images_listingId_approved_position_idx"
  ON "listing_images"("listingId", "approved", "position");

DROP INDEX IF EXISTS "listings_approval_createdAt_idx";
ALTER TABLE "listings" DROP COLUMN IF EXISTS "approval",
                       DROP COLUMN IF EXISTS "approvalNote",
                       DROP COLUMN IF EXISTS "approvalDecidedAt";
DROP TYPE IF EXISTS "ListingApproval";

COMMIT;
