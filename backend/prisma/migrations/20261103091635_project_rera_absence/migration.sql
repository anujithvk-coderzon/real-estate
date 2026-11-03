-- CreateEnum
CREATE TYPE "ProjectReraAbsence" AS ENUM ('PRE_RERA', 'SMALL_PROJECT', 'UNKNOWN');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "projectReraAbsence" "ProjectReraAbsence";
