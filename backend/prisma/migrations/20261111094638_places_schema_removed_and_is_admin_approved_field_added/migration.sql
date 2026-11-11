/*
  Warnings:

  - You are about to drop the `place_names` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "isAdminApproved" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "place_names";
