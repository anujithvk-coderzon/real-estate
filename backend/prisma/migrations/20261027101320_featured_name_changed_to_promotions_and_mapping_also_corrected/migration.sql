/*
  Warnings:

  - You are about to drop the `featured` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "featured";

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "projectId" TEXT,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "promotions_isActive_idx" ON "promotions"("isActive");
