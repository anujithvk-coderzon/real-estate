/*
  Warnings:

  - Added the required column `district` to the `listings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "district" TEXT NOT NULL;
