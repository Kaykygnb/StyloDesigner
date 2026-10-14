-- Publicação guarda o zip gerado (hash no armazenamento de blobs), o tamanho e o nome dado pela pessoa.
ALTER TABLE "PublishRecord" ADD COLUMN "label" TEXT;
ALTER TABLE "PublishRecord" ADD COLUMN "blobHash" TEXT;
ALTER TABLE "PublishRecord" ADD COLUMN "bytes" INTEGER;
