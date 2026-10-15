-- AlterTable
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_pkey" PRIMARY KEY ("id");

-- DropIndex
DROP INDEX "user_interests_id_key";
