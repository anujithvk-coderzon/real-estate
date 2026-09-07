/*
  Warnings:

  - You are about to drop the `Amenity` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_AmenityToListing" DROP CONSTRAINT "_AmenityToListing_A_fkey";

-- DropTable
DROP TABLE "Amenity";

-- CreateTable
CREATE TABLE "amenities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amenities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "amenities_name_key" ON "amenities"("name");

-- AddForeignKey
ALTER TABLE "_AmenityToListing" ADD CONSTRAINT "_AmenityToListing_A_fkey" FOREIGN KEY ("A") REFERENCES "amenities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
