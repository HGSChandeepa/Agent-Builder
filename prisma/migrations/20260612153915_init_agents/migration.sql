-- CreateEnum
CREATE TYPE "AgentEnvironment" AS ENUM ('development', 'staging', 'production');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "environment" "AgentEnvironment" NOT NULL DEFAULT 'development',
    "status" "AgentStatus" NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agents_environment_idx" ON "agents"("environment");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "agents_updated_at_idx" ON "agents"("updated_at" DESC);
