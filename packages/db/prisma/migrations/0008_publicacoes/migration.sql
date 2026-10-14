CREATE TABLE "PublishRecord" (
  "id" UUID NOT NULL,
  "projectId" UUID NOT NULL,
  "format" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "warnings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PublishRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublishRecord_projectId_createdAt_idx" ON "PublishRecord"("projectId", "createdAt");
ALTER TABLE "PublishRecord" ADD CONSTRAINT "PublishRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
