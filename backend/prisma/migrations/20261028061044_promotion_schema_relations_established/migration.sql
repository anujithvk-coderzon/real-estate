/*
  Warnings:

  - A unique constraint covering the columns `[listingId]` on the table `promotions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[projectId]` on the table `promotions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "promotions_userId_idx" ON "promotions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_listingId_key" ON "promotions"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_projectId_key" ON "promotions"("projectId");

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
