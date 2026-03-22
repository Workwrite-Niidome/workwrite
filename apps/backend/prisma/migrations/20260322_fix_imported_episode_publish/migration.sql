-- Fix: Imported episodes were created without publishedAt, making them invisible to readers.
-- Publish all episodes belonging to published works where the episode has no publishedAt.
UPDATE "Episode"
SET "publishedAt" = "createdAt"
WHERE "publishedAt" IS NULL
  AND "workId" IN (
    SELECT "id" FROM "Work" WHERE "status" = 'PUBLISHED'
  );
