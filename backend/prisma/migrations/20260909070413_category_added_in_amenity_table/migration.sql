/*
  Warnings:

  - Added the required column `category` to the `amenities` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "amenities" ADD COLUMN     "category" TEXT NOT NULL;
