-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'MODEL3D', 'LOTTIE', 'FONT', 'OTHER');

-- CreateTable
CREATE TABLE "LibraryAsset" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" DOUBLE PRECISION,
    "tags" TEXT[],
    "source" TEXT NOT NULL DEFAULT 'upload',
    "sourceUrl" TEXT,
    "license" JSONB,
    "credit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LibraryAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderSecret" (
    "userId" UUID NOT NULL,
    "providerId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderSecret_pkey" PRIMARY KEY ("userId","providerId")
);

-- CreateTable
CREATE TABLE "AssetSource" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryAsset_userId_kind_idx" ON "LibraryAsset"("userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "LibraryAsset_userId_hash_key" ON "LibraryAsset"("userId", "hash");

-- CreateIndex
CREATE UNIQUE INDEX "AssetSource_userId_name_key" ON "AssetSource"("userId", "name");

-- AddForeignKey
ALTER TABLE "LibraryAsset" ADD CONSTRAINT "LibraryAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderSecret" ADD CONSTRAINT "ProviderSecret_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetSource" ADD CONSTRAINT "AssetSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

