-- Interactive Novel: Additive migration only
-- NO existing table modifications that could cause data loss
-- All new columns have DEFAULT values
-- All new tables are independent

-- ============================================================
-- PART 1: Add columns to existing tables (all with defaults)
-- ============================================================

-- Work: add interactive novel fields
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "enableInteractiveNovel" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "interactiveNovelStatus" TEXT;
ALTER TABLE "Work" ADD COLUMN IF NOT EXISTS "worldVersion" INTEGER NOT NULL DEFAULT 0;

-- EpisodeAnalysis: add interactive novel enrichment fields
ALTER TABLE "EpisodeAnalysis" ADD COLUMN IF NOT EXISTS "spatialData" JSONB;
ALTER TABLE "EpisodeAnalysis" ADD COLUMN IF NOT EXISTS "sceneBreakdown" JSONB;
ALTER TABLE "EpisodeAnalysis" ADD COLUMN IF NOT EXISTS "characterMovement" JSONB;
ALTER TABLE "EpisodeAnalysis" ADD COLUMN IF NOT EXISTS "interactiveVersion" INTEGER DEFAULT 0;

-- ============================================================
-- PART 2: Create new tables (no impact on existing data)
-- ============================================================

-- WorldLocation
CREATE TABLE "WorldLocation" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "derivedFrom" JSONB,
    "generationStatus" TEXT NOT NULL DEFAULT 'skeleton',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorldLocation_pkey" PRIMARY KEY ("id")
);

-- LocationConnection
CREATE TABLE "LocationConnection" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "fromLocationId" TEXT NOT NULL,
    "toLocationId" TEXT NOT NULL,
    "description" TEXT,
    "travelTime" TEXT,
    CONSTRAINT "LocationConnection_pkey" PRIMARY KEY ("id")
);

-- LocationRendering
CREATE TABLE "LocationRendering" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "timeOfDay" TEXT NOT NULL,
    "sensoryText" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LocationRendering_pkey" PRIMARY KEY ("id")
);

-- StoryEvent
CREATE TABLE "StoryEvent" (
    "id" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "orderInEpisode" INTEGER NOT NULL,
    "timelinePosition" DOUBLE PRECISION NOT NULL,
    "locationId" TEXT,
    "characters" JSONB,
    "emotionalTone" TEXT,
    "significance" TEXT NOT NULL,
    "textStartOffset" INTEGER NOT NULL,
    "textEndOffset" INTEGER NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoryEvent_pkey" PRIMARY KEY ("id")
);

-- CharacterSchedule
CREATE TABLE "CharacterSchedule" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "timeStart" DOUBLE PRECISION NOT NULL,
    "timeEnd" DOUBLE PRECISION NOT NULL,
    "locationId" TEXT,
    "activity" TEXT,
    "withCharacters" JSONB,
    "mood" TEXT,
    "episodeId" TEXT,
    CONSTRAINT "CharacterSchedule_pkey" PRIMARY KEY ("id")
);

-- ReaderWorldState
CREATE TABLE "ReaderWorldState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "locationId" TEXT,
    "timelinePosition" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "perspective" TEXT NOT NULL DEFAULT 'character',
    "entryLayer" INTEGER NOT NULL DEFAULT 2,
    "lastEventId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReaderWorldState_pkey" PRIMARY KEY ("id")
);

-- ReaderWitnessedEvent
CREATE TABLE "ReaderWitnessedEvent" (
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "storyEventId" TEXT NOT NULL,
    "witnessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaderWitnessedEvent_pkey" PRIMARY KEY ("userId","workId","storyEventId")
);

-- ReaderDiscoveredLocation
CREATE TABLE "ReaderDiscoveredLocation" (
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReaderDiscoveredLocation_pkey" PRIMARY KEY ("userId","workId","locationId")
);

-- JourneyLog
CREATE TABLE "JourneyLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workId" TEXT NOT NULL,
    "locationId" TEXT,
    "timelinePosition" DOUBLE PRECISION,
    "perspective" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JourneyLog_pkey" PRIMARY KEY ("id")
);

-- PerspectiveCache
CREATE TABLE "PerspectiveCache" (
    "id" TEXT NOT NULL,
    "storyEventId" TEXT NOT NULL,
    "perspective" TEXT NOT NULL,
    "renderedText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PerspectiveCache_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- PART 3: Indexes (performance, no data impact)
-- ============================================================

CREATE INDEX "WorldLocation_workId_idx" ON "WorldLocation"("workId");
CREATE INDEX "WorldLocation_workId_type_idx" ON "WorldLocation"("workId", "type");

CREATE INDEX "LocationConnection_fromLocationId_idx" ON "LocationConnection"("fromLocationId");
CREATE INDEX "LocationConnection_toLocationId_idx" ON "LocationConnection"("toLocationId");

CREATE UNIQUE INDEX "LocationRendering_locationId_timeOfDay_key" ON "LocationRendering"("locationId", "timeOfDay");

CREATE INDEX "StoryEvent_episodeId_orderInEpisode_idx" ON "StoryEvent"("episodeId", "orderInEpisode");
CREATE INDEX "StoryEvent_workId_timelinePosition_idx" ON "StoryEvent"("workId", "timelinePosition");
CREATE INDEX "StoryEvent_locationId_idx" ON "StoryEvent"("locationId");

CREATE INDEX "CharacterSchedule_characterId_timeStart_idx" ON "CharacterSchedule"("characterId", "timeStart");
CREATE INDEX "CharacterSchedule_workId_idx" ON "CharacterSchedule"("workId");
CREATE INDEX "CharacterSchedule_locationId_timeStart_timeEnd_idx" ON "CharacterSchedule"("locationId", "timeStart", "timeEnd");

CREATE UNIQUE INDEX "ReaderWorldState_userId_workId_key" ON "ReaderWorldState"("userId", "workId");

CREATE INDEX "ReaderWitnessedEvent_userId_workId_idx" ON "ReaderWitnessedEvent"("userId", "workId");

CREATE INDEX "JourneyLog_userId_workId_createdAt_idx" ON "JourneyLog"("userId", "workId", "createdAt" DESC);
CREATE INDEX "JourneyLog_workId_createdAt_idx" ON "JourneyLog"("workId", "createdAt" DESC);
CREATE INDEX "JourneyLog_userId_workId_action_idx" ON "JourneyLog"("userId", "workId", "action");

CREATE UNIQUE INDEX "PerspectiveCache_storyEventId_perspective_key" ON "PerspectiveCache"("storyEventId", "perspective");

-- ============================================================
-- PART 4: Foreign keys (referential integrity)
-- ============================================================

-- WorldLocation
ALTER TABLE "WorldLocation" ADD CONSTRAINT "WorldLocation_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LocationConnection
ALTER TABLE "LocationConnection" ADD CONSTRAINT "LocationConnection_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationConnection" ADD CONSTRAINT "LocationConnection_fromLocationId_fkey" FOREIGN KEY ("fromLocationId") REFERENCES "WorldLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LocationConnection" ADD CONSTRAINT "LocationConnection_toLocationId_fkey" FOREIGN KEY ("toLocationId") REFERENCES "WorldLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LocationRendering
ALTER TABLE "LocationRendering" ADD CONSTRAINT "LocationRendering_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorldLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- StoryEvent
ALTER TABLE "StoryEvent" ADD CONSTRAINT "StoryEvent_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryEvent" ADD CONSTRAINT "StoryEvent_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoryEvent" ADD CONSTRAINT "StoryEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorldLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CharacterSchedule
ALTER TABLE "CharacterSchedule" ADD CONSTRAINT "CharacterSchedule_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "StoryCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterSchedule" ADD CONSTRAINT "CharacterSchedule_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorldLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ReaderWorldState
ALTER TABLE "ReaderWorldState" ADD CONSTRAINT "ReaderWorldState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReaderWorldState" ADD CONSTRAINT "ReaderWorldState_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ReaderWitnessedEvent
ALTER TABLE "ReaderWitnessedEvent" ADD CONSTRAINT "ReaderWitnessedEvent_storyEventId_fkey" FOREIGN KEY ("storyEventId") REFERENCES "StoryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ReaderDiscoveredLocation
ALTER TABLE "ReaderDiscoveredLocation" ADD CONSTRAINT "ReaderDiscoveredLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WorldLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- JourneyLog
ALTER TABLE "JourneyLog" ADD CONSTRAINT "JourneyLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JourneyLog" ADD CONSTRAINT "JourneyLog_workId_fkey" FOREIGN KEY ("workId") REFERENCES "Work"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PerspectiveCache
ALTER TABLE "PerspectiveCache" ADD CONSTRAINT "PerspectiveCache_storyEventId_fkey" FOREIGN KEY ("storyEventId") REFERENCES "StoryEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
