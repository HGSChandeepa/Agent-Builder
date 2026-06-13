-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('gmail', 'outlook', 'slack', 'microsoft_teams', 'google_drive', 'notion', 'hubspot');

-- CreateEnum
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('connected', 'disconnected', 'error', 'token_expired');

-- AlterTable
ALTER TABLE "agents" ADD COLUMN     "integrations" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'disconnected',
    "account_email" VARCHAR(320),
    "account_name" VARCHAR(255),
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "access_token_enc" TEXT,
    "refresh_token_enc" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_activity_logs" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "integration_connections_provider_idx" ON "integration_connections"("provider");

-- CreateIndex
CREATE INDEX "integration_connections_status_idx" ON "integration_connections"("status");

-- CreateIndex
CREATE INDEX "integration_connections_updated_at_idx" ON "integration_connections"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "integration_activity_logs_connection_id_created_at_idx" ON "integration_activity_logs"("connection_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "integration_activity_logs_action_idx" ON "integration_activity_logs"("action");

-- CreateIndex
CREATE INDEX "integration_activity_logs_status_idx" ON "integration_activity_logs"("status");

-- AddForeignKey
ALTER TABLE "integration_activity_logs" ADD CONSTRAINT "integration_activity_logs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
