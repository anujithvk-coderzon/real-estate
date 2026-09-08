-- CreateTable
CREATE TABLE "listing_videos" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_videos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "listing_videos_videoId_key" ON "listing_videos"("videoId");

-- CreateIndex
CREATE UNIQUE INDEX "listing_videos_listingId_key" ON "listing_videos"("listingId");

-- AddForeignKey
ALTER TABLE "listing_videos" ADD CONSTRAINT "listing_videos_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
