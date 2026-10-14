CREATE TABLE "AgentProject" (
  "agentId" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentProject_pkey" PRIMARY KEY ("agentId", "projectId")
);

CREATE INDEX "AgentProject_projectId_idx" ON "AgentProject"("projectId");
ALTER TABLE "AgentProject" ADD CONSTRAINT "AgentProject_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AgentProject" ADD CONSTRAINT "AgentProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
