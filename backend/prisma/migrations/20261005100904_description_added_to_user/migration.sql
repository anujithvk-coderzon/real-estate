/*
  Warnings:

  - The values [DEALER] on the enum `PostedBy` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PostedBy_new" AS ENUM ('OWNER', 'BROKER', 'BUILDER');
ALTER TABLE "public"."users" ALTER COLUMN "accountType" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "accountType" TYPE "PostedBy_new" USING ("accountType"::text::"PostedBy_new");
ALTER TABLE "listings" ALTER COLUMN "postedBy" TYPE "PostedBy_new" USING ("postedBy"::text::"PostedBy_new");
ALTER TYPE "PostedBy" RENAME TO "PostedBy_old";
ALTER TYPE "PostedBy_new" RENAME TO "PostedBy";
DROP TYPE "public"."PostedBy_old";
ALTER TABLE "users" ALTER COLUMN "accountType" SET DEFAULT 'OWNER';
COMMIT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "description" TEXT;
