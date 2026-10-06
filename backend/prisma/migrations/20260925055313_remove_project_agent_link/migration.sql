/*
  Warnings:

  - You are about to drop the `project_agents` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "project_agents" DROP CONSTRAINT "project_agents_agentId_fkey";

-- DropForeignKey
ALTER TABLE "project_agents" DROP CONSTRAINT "project_agents_projectId_fkey";

-- DropTable
DROP TABLE "project_agents";

-- DropEnum
DROP TYPE "AgentLinkStatus";
