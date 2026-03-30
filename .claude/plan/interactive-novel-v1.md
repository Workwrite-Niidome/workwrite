# Interactive Novel v1 — Implementation Plan

**Date:** 2026-03-30
**Status:** Draft — Pending user review
**Scope:** Aria (single work) → 汎用化は Phase 4 以降

---

## 0. Multi-Agent Review Summary

4つのスペシャリストが並列でレビューした結果の統合。

### 合意点（全エージェント一致）
- コンセプトは正しい。「干渉ではなく体験」は新規性がある
- 事前生成の全量一括はNG。Lazy生成 + オンデマンドキャッシュが正解
- ReaderWorldState.witnessedEvents TEXT[] は破綻する。別テーブルに切り出し
- 自由テキスト入力のみは致命的。コンテキストアクションパレットが必須
- 既存CharacterTalkServiceの拡張ではなくラッパー（Composition）で統合

### 相違点と判断
| 論点 | システムアーキテクト | UXアーキテクト | DB | Security | 採用案 |
|------|---------------------|---------------|-----|----------|--------|
| StoryEvent.originalText | オフセットで参照 | 原文40%以上必須 | — | 露出リスク | **オフセット参照。レンダリング時にepisode.contentから切り出し** |
| timeline-engine.service | 不要（float管理のみ） | 時間は主軸にしない | — | — | **削除。character-presenceとscene-composerに分散** |
| 読者のロール | — | 3択から選べ | — | — | **Option B「witness」を採用。読者は注意の行為者** |
| レイヤー選択UI | — | Progressive depth | — | — | **レイヤー選択を廃止。2つの入口 + 自然な深化** |
| 3軸の操作 | — | 場所を主軸に | — | — | **Where主軸。When/Howは従属** |

### 即時修正すべき既存バグ（セキュリティレビューで発見）
1. `character-talk.service.ts` L99-101: episodes取得に `publishedAt` フィルタがない → **未公開エピソード露出**
2. character-talk controller: DTOなし、`message`に長さ制限なし → **トークン飽和攻撃可能**

---

## 1. Architecture Overview

### 1.1 Design Principles

```
物語は聖域        → テキストは一文字も変わらない
世界は生きている   → キャラクターが存在し、時間が流れる
読者は witness     → 注意の行為者。干渉ではなく体験
Where が主軸       → 読者が場所を選ぶ。時間と視点は従属
Lazy generation   → 読者が訪れた場所だけ生成。未訪問はスケルトン
Original text ≥ 40% → AI生成が原文を超えてはならない
```

### 1.2 System Diagram

```
┌─ Frontend ──────────────────────────────────┐
│  /experience/[workId]                        │
│  ├── ExperienceShell (fullscreen, no chrome) │
│  ├── TheaterView (scrolling experience text) │
│  ├── ActionPalette (contextual suggestions)  │
│  ├── PerspectiveSwitcher (on key moments)    │
│  └── JourneyMap (optional, power feature)    │
└──────────────┬──────────────────────────────┘
               │ REST (fast) + SSE (generative)
┌─ Backend ────┴──────────────────────────────┐
│  InteractiveNovelModule                      │
│  ├── Controller (REST + SSE endpoints)       │
│  ├── SceneComposerService (orchestration)    │
│  ├── WorldBuilderService (data pipeline)     │
│  ├── CharacterPresenceService (who/where)    │
│  ├── PerspectiveRendererService (how)        │
│  ├── ReaderStateService (reader tracking)    │
│  ├── WorldConversationService (wraps CT)     │
│  ├── IntentParserService (input → action)    │
│  └── EventSplitterService (ep → events)      │
└──────────────┬──────────────────────────────┘
               │
┌─ Database ───┴──────────────────────────────┐
│  WorldLocation, LocationConnection           │
│  LocationRendering (sensory cache)           │
│  StoryEvent (offset-based, no text dup)      │
│  CharacterSchedule                           │
│  ReaderWorldState (snapshot only)            │
│  ReaderWitnessedEvent (切り出し)             │
│  ReaderDiscoveredLocation (切り出し)         │
│  JourneyLog (append-only, indexed)           │
│  PerspectiveCache                            │
└─────────────────────────────────────────────┘
```

---

## 2. Data Models (DB Review反映済み)

### 2.1 New Prisma Models

```prisma
// ===== World Structure =====

model WorldLocation {
  id               String   @id @default(cuid())
  workId           String
  name             String
  type             String   // interior | exterior | abstract
  description      String   @db.Text
  derivedFrom      Json?    // [{ episodeId, orderIndex }]
  generationStatus String   @default("skeleton") // skeleton | partial | complete
  createdAt        DateTime @default(now())

  work               Work                 @relation(fields: [workId], references: [id], onDelete: Cascade)
  connectionsFrom    LocationConnection[] @relation("FromLocation")
  connectionsTo      LocationConnection[] @relation("ToLocation")
  renderings         LocationRendering[]
  storyEvents        StoryEvent[]
  characterSchedules CharacterSchedule[]

  @@index([workId])
  @@index([workId, type])
}

model LocationConnection {
  id             String @id @default(cuid())
  workId         String
  fromLocationId String
  toLocationId   String
  description    String?
  travelTime     String?

  work         Work          @relation(fields: [workId], references: [id], onDelete: Cascade)
  fromLocation WorldLocation @relation("FromLocation", fields: [fromLocationId], references: [id], onDelete: Cascade)
  toLocation   WorldLocation @relation("ToLocation", fields: [toLocationId], references: [id], onDelete: Cascade)

  @@index([fromLocationId])
  @@index([toLocationId])
  @@check(fromLocationId != toLocationId) // Prisma doesn't support CHECK natively; add in migration SQL
}

model LocationRendering {
  id          String   @id @default(cuid())
  locationId  String
  timeOfDay   String   // dawn | morning | afternoon | evening | night | late_night
  sensoryText Json     // { visual, auditory, olfactory, tactile, atmospheric }
  createdAt   DateTime @default(now())

  location WorldLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@unique([locationId, timeOfDay])
}

// ===== Story Events =====

model StoryEvent {
  id               String   @id @default(cuid())
  workId           String
  episodeId        String
  orderInEpisode   Int
  timelinePosition Float    // 0.0~1.0 normalized across entire work
  locationId       String?
  characters       Json?    // [{ characterId?, name, role }]
  emotionalTone    String?
  significance     String   // key | normal | ambient
  textStartOffset  Int      // character offset in Episode.content
  textEndOffset    Int      // character offset in Episode.content
  summary          String?  @db.Text
  createdAt        DateTime @default(now())

  work     Work           @relation(fields: [workId], references: [id], onDelete: Cascade)
  episode  Episode        @relation(fields: [episodeId], references: [id], onDelete: Cascade)
  location WorldLocation? @relation(fields: [locationId], references: [id], onDelete: SetNull)
  perspectiveCaches PerspectiveCache[]
  witnessedBy       ReaderWitnessedEvent[]

  @@index([episodeId, orderInEpisode])
  @@index([workId, timelinePosition])
  @@index([locationId])
}

model CharacterSchedule {
  id            String  @id @default(cuid())
  characterId   String
  workId        String
  timeStart     Float   // 0.0~1.0 (work-level normalized)
  timeEnd       Float
  locationId    String?
  activity      String?
  withCharacters Json?  // [{ characterId, name }]
  mood          String?
  episodeId     String?

  character StoryCharacter @relation(fields: [characterId], references: [id], onDelete: Cascade)
  location  WorldLocation? @relation(fields: [locationId], references: [id], onDelete: SetNull)

  @@index([characterId, timeStart])
  @@index([workId])
  @@index([locationId, timeStart, timeEnd])
}

// ===== Reader State =====

model ReaderWorldState {
  id               String   @id @default(cuid())
  userId           String
  workId           String
  locationId       String?
  timelinePosition Float    @default(0.0)
  perspective      String   @default("character") // protagonist | character | omniscient
  entryLayer       Int      @default(2)
  lastEventId      String?
  updatedAt        DateTime @updatedAt

  user     User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  work     Work           @relation(fields: [workId], references: [id], onDelete: Cascade)

  @@unique([userId, workId])
}

model ReaderWitnessedEvent {
  userId       String
  workId       String
  storyEventId String
  witnessedAt  DateTime @default(now())

  storyEvent StoryEvent @relation(fields: [storyEventId], references: [id], onDelete: Cascade)

  @@id([userId, workId, storyEventId])
  @@index([userId, workId])
}

model ReaderDiscoveredLocation {
  userId       String
  workId       String
  locationId   String
  discoveredAt DateTime @default(now())

  location WorldLocation @relation(fields: [locationId], references: [id], onDelete: Cascade)

  @@id([userId, workId, locationId])
}

model JourneyLog {
  id               String   @id @default(cuid())
  userId           String
  workId           String
  locationId       String?
  timelinePosition Float?
  perspective      String?
  action           String   @db.VarChar(50) // move | observe | talk | perspective | time
  detail           Json?
  createdAt        DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  work Work @relation(fields: [workId], references: [id], onDelete: Cascade)

  @@index([userId, workId, createdAt(sort: Desc)])
  @@index([workId, createdAt(sort: Desc)])
  @@index([userId, workId, action])
}

model PerspectiveCache {
  id           String   @id @default(cuid())
  storyEventId String
  perspective  String   // protagonist | character | omniscient
  renderedText String   @db.Text
  createdAt    DateTime @default(now())

  storyEvent StoryEvent @relation(fields: [storyEventId], references: [id], onDelete: Cascade)

  @@unique([storyEventId, perspective])
}
```

### 2.2 Existing Model Changes

```prisma
model Work {
  // 追加フィールド
  enableInteractiveNovel  Boolean @default(false)
  interactiveNovelStatus  String? // null | building | ready | failed
  worldVersion            Int     @default(0)

  // 追加リレーション
  worldLocations     WorldLocation[]
  locationConnections LocationConnection[]
  storyEvents        StoryEvent[]
  readerWorldStates  ReaderWorldState[]
  journeyLogs        JourneyLog[]
}

model EpisodeAnalysis {
  // 追加フィールド（Interactive Novel enrichment）
  spatialData       Json?  // [{ location, type, sensoryHints, charactersPresent[], timeOfDay }]
  sceneBreakdown    Json?  // [{ startOffset, endOffset, location, characters, emotion, significance }]
  characterMovement Json?  // [{ character, movements: [{ from, to, trigger }] }]
  interactiveVersion Int?  @default(0)
}

model Episode {
  // 追加リレーション
  storyEvents StoryEvent[]
}

model StoryCharacter {
  // 追加リレーション
  schedules CharacterSchedule[]
}
```

---

## 3. API Endpoints

### 3.1 Fast Actions (REST, no SSE)

```
POST /interactive-novel/:workId/enter
  Body: { entryType: 'read' | 'explore' }
  Returns: { state: ReaderWorldState, scene: RenderedScene }

POST /interactive-novel/:workId/move
  Body: { locationId: string }
  Returns: { state: ReaderWorldState, scene: RenderedScene }

POST /interactive-novel/:workId/perspective
  Body: { mode: 'protagonist' | 'character' | 'omniscient' }
  Returns: { scene: RenderedScene }

POST /interactive-novel/:workId/time-advance
  Returns: { state: ReaderWorldState, scene: RenderedScene }

GET  /interactive-novel/:workId/state
  Returns: { state: ReaderWorldState }

GET  /interactive-novel/:workId/journey
  Returns: { logs: JourneyLog[], stats: JourneyStats }

GET  /interactive-novel/:workId/locations
  Returns: { locations: WorldLocation[], connections: LocationConnection[] }
```

### 3.2 Streaming Actions (SSE)

```
POST /interactive-novel/:workId/observe
  Body: { target: 'environment' | characterId }
  Returns: SSE stream → { text: string } chunks

POST /interactive-novel/:workId/talk
  Body: { characterId: string, message: string }
  Returns: SSE stream → { text: string } chunks (delegates to WorldConversationService)

POST /interactive-novel/:workId/experience
  Body: { input: string }
  Returns: SSE stream (free-form intent parsed → appropriate action)
```

### 3.3 Author Endpoints

```
POST /interactive-novel/:workId/build-world
  Triggers world building pipeline (author-initiated, costs credits)
  Returns: { status: 'building', estimatedCredits: number }

GET  /interactive-novel/:workId/build-status
  Returns: { status: string, progress: { locations, events, schedules } }
```

---

## 4. Backend Module Structure

```
apps/backend/src/interactive-novel/
├── interactive-novel.module.ts
├── interactive-novel.controller.ts
├── dto/
│   ├── enter.dto.ts              // { entryType } + validation
│   ├── move.dto.ts               // { locationId } + validation
│   ├── talk.dto.ts               // { characterId, message: @MaxLength(500) }
│   └── experience.dto.ts         // { input: @MaxLength(500) }
├── services/
│   ├── scene-composer.service.ts        // Orchestration: state + world → RenderedScene
│   ├── world-builder.service.ts         // Data pipeline: EpisodeAnalysis → World data
│   ├── event-splitter.service.ts        // Episode → StoryEvent (offset-based)
│   ├── character-presence.service.ts    // Who is where at time T
│   ├── perspective-renderer.service.ts  // Perspective-aware rendering + spoiler protection
│   ├── reader-state.service.ts          // ReaderWorldState CRUD + JourneyLog
│   ├── world-conversation.service.ts    // Wraps CharacterTalkService with world context
│   └── intent-parser.service.ts         // Two-tier: pattern match → AI fallback
└── types/
    ├── world.types.ts
    ├── experience.types.ts
    └── reader.types.ts
```

---

## 5. Frontend Experience Design

### 5.1 Route & Layout

```
/experience/[workId]/page.tsx     → Main experience page
```

LayoutShell に追加: `/experience/*` は `hideChrome = true`（ヘッダー/フッター/サイドバー全非表示）

### 5.2 UI Structure

```
┌──────────────────────────────────────────┐
│ ○ 栞堂                午後   [👁 視点]  │ ← ミニマルヘッダー (auto-hide)
├──────────────────────────────────────────┤
│                                          │
│  午後の光が磨りガラスを通って広がる。     │ ← TheaterView
│  古い紙とインクの匂い。                  │    (scrolling experience)
│                                          │
│  榊がカウンターの向こうで本を読んでいる。 │
│  ページをめくる指がゆっくりと動く。       │
│                                          │
│  ───── * ─────                           │
│                                          │
│  「いらっしゃい。ゆっくりしていって       │ ← Original text (serif, full weight)
│   ください」                             │
│                                          │
│                                          │
├──────────────────────────────────────────┤
│  本棚を見る    榊と話す    外に出る       │ ← ActionPalette (contextual)
│                                          │
│  ▸ 自分の言葉で...                       │ ← Collapsed free input
└──────────────────────────────────────────┘
```

### 5.3 Interaction Model

**Primary: Contextual Action Palette (タップ)**
- 2-4 actions generated per scene
- Phrased as prose, not buttons: 「本棚を見る」「榊と話す」「外に出る」
- Changes based on: location, time, present characters, recent events

**Secondary: Free text input (展開式)**
- Collapsed by default
- Available for power users / conversation
- `@MaxLength(500)`, rate-limited

**Mobile: Swipe gestures**
- Swipe right → time advance
- Swipe up → expand action palette
- Long press on text → perspective hint

### 5.4 Onboarding (90 seconds, no tutorial)

1. **Cold open** — pre-written scene text, no UI chrome
2. **First action** — single suggestion appears: 「中に入る」
3. **First encounter** — Sakaki acknowledges reader
4. **First perspective hint** — after 3 interactions: 「榊の考えを知る [視点を変える]」
5. **Full UI reveal** — action palette, header, all controls appear gradually

### 5.5 Text Hierarchy

```css
.original-text   { font-family: var(--font-serif); font-weight: 400; }
.generated-text  { font-family: var(--font-serif); font-weight: 300; opacity: 0.85; }
.character-speech { border-left: 3px solid var(--character-color); padding-left: 1em; }
.reader-action   { font-family: var(--font-sans); color: var(--color-muted-foreground); }
.ambient-text    { font-family: var(--font-serif); font-weight: 300; font-size: 0.9em; }
```

---

## 6. Key Algorithms

### 6.1 Intent Parser (Two-Tier)

```typescript
parseIntent(input: string, context: SceneContext): ReaderAction | null {
  const normalized = input.trim();

  // Tier 1: Pattern matching (instant, no AI)
  for (const loc of context.availableLocations) {
    if (normalized.includes(loc.name)) return { type: 'move', to: loc.id };
  }
  for (const char of context.presentCharacters) {
    if (normalized.includes(char.name.split('（')[0])) {
      return { type: 'talk', to: char.id, message: input };
    }
  }
  if (/見る|観察|眺める|look/.test(normalized)) {
    return { type: 'observe', target: 'environment' };
  }

  // Tier 2: AI intent parsing (rate-limited, 10/min/user)
  return null; // falls through to AI
}
```

### 6.2 Spoiler Protection in World

```typescript
async renderEvent(event: StoryEvent, readerState, readProgress): RenderedScene {
  const hasReadEpisode = readProgress.some(
    p => p.episodeId === event.episodeId && p.completed
  );

  if (!hasReadEpisode) {
    // Spoiler mode: atmosphere only, no plot details
    return {
      renderedText: await this.generateAmbientDescription(event),
      originalPassage: null,  // NEVER show original for unread
      spoilerProtected: true,
    };
  }

  // Full rendering with original text
  const originalText = episode.content.slice(event.textStartOffset, event.textEndOffset);
  return this.renderFull(event, originalText, readerState.perspective);
}
```

### 6.3 Scene Composition Flow

```typescript
async composeScene(userId, workId): RenderedScene {
  const state = await this.readerState.getState(userId, workId);
  const location = await this.getLocation(state.locationId);
  const timeOfDay = this.getTimeOfDay(state.timelinePosition);
  const characters = await this.characterPresence.getCharactersAt(
    state.locationId, state.timelinePosition
  );
  const events = await this.getEventsAt(state.locationId, state.timelinePosition);
  const readProgress = await this.getReadProgress(userId, workId);

  // Environment (cached or generate)
  const environment = await this.getOrGenerateRendering(location, timeOfDay);

  // Events (spoiler-aware)
  const renderedEvents = await Promise.all(
    events.map(e => this.perspectiveRenderer.renderEvent(e, state, readProgress))
  );

  // Characters present
  const characterBlocks = characters.map(c => ({
    characterId: c.id,
    name: c.name,
    activity: c.activity,
    interactable: true,
  }));

  // Action suggestions
  const actions = this.generateActionSuggestions(location, characters, events);

  return { environment, events: renderedEvents, characters: characterBlocks, actions };
}
```

---

## 7. Security & Cost Controls

### 7.1 Input Validation (all DTOs)
- `@MaxLength(500)` on all user text inputs
- `@IsEnum()` on perspective, action types
- `@IsUUID()` on all ID references

### 7.2 Rate Limiting
- `@Throttle({ default: { ttl: 60000, limit: 30 } })` on controller
- AI intent parsing: 10/min/user
- SSE connections: 1 per user per work

### 7.3 Credit Consumption
- Enter world: Free
- Move / time advance: Free (no AI)
- Observe (cached): Free
- Observe (generate): 0.5 cr
- Talk: 1 cr (Haiku) / 2 cr (Sonnet)
- Free-form experience: 1 cr

### 7.4 Cost Amortization
- World building: author-initiated, 10-20 cr one-time cost
- LocationRendering: generated on first reader visit, cached forever
- PerspectiveCache: generated on first request, cached forever
- JourneyLog: 90-day retention, older records archived

### 7.5 Immediate Bug Fixes (Pre-implementation)
1. `character-talk.service.ts` L99: Add `where: { publishedAt: { not: null } }` to episodes query
2. Create `ChatDto` with `@MaxLength(2000)` for existing character-talk endpoint

---

## 8. Implementation Phases

### Phase 0: Foundation (Pre-requisites)
**Deliverables:**
1. Fix existing security bugs (publishedAt filter, DTO validation)
2. Add `enableInteractiveNovel`, `interactiveNovelStatus`, `worldVersion` to Work model
3. Add `spatialData`, `sceneBreakdown`, `characterMovement` to EpisodeAnalysis model
4. Run enriched EpisodeAnalysis on all 21 Aria episodes
5. Create all new Prisma models (migration)
6. Add ThrottlerModule globally

**Estimated effort:** 2-3 sessions

### Phase 1: World Building Pipeline (Aria)
**Deliverables:**
1. WorldBuilderService: EpisodeAnalysis → WorldLocation + LocationConnection
2. EventSplitterService: Episode → StoryEvent (offset-based)
3. CharacterPresenceService: derive schedules from analysis data
4. Build world for Aria (manual trigger)
5. Verify data quality

**Estimated effort:** 2-3 sessions

### Phase 2: Minimum Experience
**Deliverables:**
1. SceneComposerService: state + world → RenderedScene
2. ReaderStateService: enter, move, state management
3. PerspectiveRendererService: character perspective only (single perspective first)
4. IntentParserService: Tier 1 only (pattern matching)
5. REST endpoints: enter, move, state, locations
6. Frontend: ExperienceShell + TheaterView + ActionPalette
7. 90-second onboarding flow

**Estimated effort:** 3-4 sessions

### Phase 3: Conversation & Streaming
**Deliverables:**
1. WorldConversationService: wraps CharacterTalkService
2. SSE endpoints: observe, talk
3. LocationRendering generation (on-demand)
4. Frontend: character interaction within theater view
5. Credit consumption integration

**Estimated effort:** 2-3 sessions

### Phase 4: Full Experience
**Deliverables:**
1. All 3 perspectives (protagonist, character, omniscient)
2. PerspectiveCache pre-generation for key events
3. Free-form input with AI intent parsing (Tier 2)
4. JourneyMap visualization
5. Spoiler protection in world mode
6. Mobile optimization (swipe, bottom sheet)

**Estimated effort:** 3-4 sessions

### Phase 5: Polish & Generalize
**Deliverables:**
1. Author-facing world building UI
2. Generalize beyond Aria (any work with enableInteractiveNovel)
3. Layer 4 (social/交流) exploration
4. Performance optimization, caching review
5. Credit pricing finalization

**Estimated effort:** 3-4 sessions

---

## 9. Key Files to Create/Modify

| File | Operation | Description |
|------|-----------|-------------|
| `apps/backend/prisma/schema.prisma` | Modify | Add 10 new models + 3 model extensions |
| `apps/backend/src/interactive-novel/` | Create | New module (controller + 8 services + DTOs + types) |
| `apps/backend/src/character-talk/character-talk.service.ts:L99` | Modify | Add publishedAt filter (bug fix) |
| `apps/backend/src/character-talk/character-talk.controller.ts` | Modify | Add DTO validation |
| `apps/backend/src/character-talk/character-talk.service.ts` | Modify | Add `additionalContext` to StreamChatOptions |
| `apps/backend/src/ai-assist/episode-analysis.service.ts` | Modify | Add spatialData/sceneBreakdown to analysis prompt |
| `apps/backend/src/app.module.ts` | Modify | Register InteractiveNovelModule + ThrottlerModule |
| `apps/frontend/src/app/experience/[workId]/page.tsx` | Create | Main experience page |
| `apps/frontend/src/app/experience/[workId]/components/` | Create | 8+ components |
| `apps/frontend/src/components/layout/layout-shell.tsx` | Modify | Add `/experience/*` to hideChrome |
| `apps/frontend/src/lib/api.ts` | Modify | Add interactive-novel API methods |

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| AI generation quality drift | High | Original text ≥ 40% target, style-locked prompts with few-shot examples |
| Cost explosion from heavy users | High | Per-action credit cost, rate limiting, cached rendering |
| World building data quality | Medium | Manual review step for Aria, automated validation for later works |
| Reader confusion ("what do I do?") | High | Action palette, 90-sec onboarding, no blank canvas |
| Mobile experience degradation | Medium | Tap-first design, swipe gestures, bottom sheet controls |
| Stale world data after episode edit | Medium | worldVersion + lazy re-generation |
| Database growth (JourneyLog) | Low | 90-day retention, time-series index |
