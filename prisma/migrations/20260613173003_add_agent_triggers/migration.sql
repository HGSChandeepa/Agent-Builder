-- CreateEnum
CREATE TYPE "TriggerScheduleType" AS ENUM ('interval', 'daily', 'weekly', 'cron');

-- CreateTable
CREATE TABLE "agent_triggers" (
    "id" UUID NOT NULL,
    "agent_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "schedule_type" "TriggerScheduleType" NOT NULL,
    "schedule_config" JSONB NOT NULL DEFAULT '{}',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "input" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "next_run_at" TIMESTAMP(3),
    "last_run_status" VARCHAR(32),
    "total_runs" INTEGER NOT NULL DEFAULT 0,
    "successful_runs" INTEGER NOT NULL DEFAULT 0,
    "failed_runs" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trigger_executions" (
    "id" UUID NOT NULL,
    "trigger_id" UUID NOT NULL,
    "run_id" UUID,
    "status" VARCHAR(32) NOT NULL,
    "scheduled_for" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trigger_executions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agent_triggers_agent_id_idx" ON "agent_triggers"("agent_id");

-- CreateIndex
CREATE INDEX "agent_triggers_enabled_next_run_at_idx" ON "agent_triggers"("enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "agent_triggers_updated_at_idx" ON "agent_triggers"("updated_at" DESC);

-- CreateIndex
CREATE INDEX "trigger_executions_trigger_id_started_at_idx" ON "trigger_executions"("trigger_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "trigger_executions_status_idx" ON "trigger_executions"("status");

-- AddForeignKey
ALTER TABLE "agent_triggers" ADD CONSTRAINT "agent_triggers_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trigger_executions" ADD CONSTRAINT "trigger_executions_trigger_id_fkey" FOREIGN KEY ("trigger_id") REFERENCES "agent_triggers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
