-- CreateTable
CREATE TABLE "places" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "aka" TEXT[],

    CONSTRAINT "places_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "places_state_district_city_idx" ON "places"("state", "district", "city");

-- CreateIndex
CREATE UNIQUE INDEX "places_state_district_city_key" ON "places"("state", "district", "city");
