-- CreateTable
CREATE TABLE "featured" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "projectId" TEXT,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "featured_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "featured_isActive_idx" ON "featured"("isActive");
