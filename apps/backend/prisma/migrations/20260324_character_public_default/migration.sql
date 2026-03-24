-- Change default for isPublic from false to true
ALTER TABLE "StoryCharacter" ALTER COLUMN "isPublic" SET DEFAULT true;

-- Update all existing non-public characters to public
UPDATE "StoryCharacter" SET "isPublic" = true WHERE "isPublic" = false;
