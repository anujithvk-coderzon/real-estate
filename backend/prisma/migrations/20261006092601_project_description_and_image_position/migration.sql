/*
  Warnings:

  - You are about to drop the column `positon` on the `project_images` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "project_images" DROP COLUMN "positon",
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "description" TEXT;
