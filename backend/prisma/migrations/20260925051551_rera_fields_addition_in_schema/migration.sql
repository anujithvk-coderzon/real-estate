/*
  Warnings:

  - A unique constraint covering the columns `[slug]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[agentReraNumber]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AgentLinkStatus" AS ENUM ('PENDING', 'APPROVED', 'REVOKED');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "projectNameText" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accountType" "PostedBy" NOT NULL DEFAULT 'OWNER',
ADD COLUMN     "agentReraName" TEXT,
ADD COLUMN     "agentReraNumber" TEXT,
ADD COLUMN     "agentReraState" TEXT,
ADD COLUMN     "agentReraStatus" "VerificationStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "agentReraVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "slug" TEXT;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "status" "ProjectStatus" NOT NULL,
    "propertyType" "PropertyType",
    "totalUnits" INTEGER,
    "minPrice" DECIMAL(12,2),
    "maxPrice" DECIMAL(12,2),
    "startedAt" TIMESTAMP(3),
    "handoverAt" TIMESTAMP(3),
    "locality" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "reraNumber" TEXT,
    "reraState" TEXT,
    "reraStatus" "VerificationStatus" NOT NULL DEFAULT 'NONE',
    "reraVerifiedAt" TIMESTAMP(3),
    "isReraExempt" BOOLEAN NOT NULL DEFAULT false,
    "exemptReason" TEXT,
    "builderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_images" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "positon" INTEGER NOT NULL DEFAULT 0,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_agents" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "AgentLinkStatus" NOT NULL DEFAULT 'PENDING',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "projects_reraNumber_key" ON "projects"("reraNumber");

-- CreateIndex
CREATE INDEX "projects_builderId_idx" ON "projects"("builderId");

-- CreateIndex
CREATE INDEX "project_images_projectId_idx" ON "project_images"("projectId");

-- CreateIndex
CREATE INDEX "project_agents_agentId_status_idx" ON "project_agents"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_agents_projectId_agentId_key" ON "project_agents"("projectId", "agentId");

-- CreateIndex
CREATE INDEX "listings_status_latitude_longitude_idx" ON "listings"("status", "latitude", "longitude");

-- CreateIndex
CREATE INDEX "listings_projectId_idx" ON "listings"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "users_slug_key" ON "users"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_agentReraNumber_key" ON "users"("agentReraNumber");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_builderId_fkey" FOREIGN KEY ("builderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_agents" ADD CONSTRAINT "project_agents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_agents" ADD CONSTRAINT "project_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
