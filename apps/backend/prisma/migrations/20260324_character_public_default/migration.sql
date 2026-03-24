-- Change default for isPublic to true (new characters are public by default)
ALTER TABLE "StoryCharacter" ALTER COLUMN "isPublic" SET DEFAULT true;
