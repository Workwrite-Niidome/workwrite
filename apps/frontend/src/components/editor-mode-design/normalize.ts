import type { DesignData } from './types';

/**
 * Normalize AI's __DESIGN_UPDATE__ output to match our DesignData shape.
 *
 * The AI produces raw JSON with field names that differ from DesignData:
 *   genre_setting -> genre
 *   emotion       -> afterReading
 *   world         -> worldBuilding (wrapped in WorldBuildingData)
 *   plot          -> plotOutline
 *   scope         -> episodeCount + charCountPerEpisode (parsed from "10話 × 3000字")
 *
 * This function is extracted here so it can be unit-tested independently
 * of the React page component.
 */
export function normalizeDesignUpdate(raw: any): Partial<DesignData> {
  const d: Partial<DesignData> = {};
  const str = (v: any) => v && v !== 'null' ? String(v) : undefined;

  if (str(raw.genre_setting || raw.genre)) d.genre = str(raw.genre_setting || raw.genre);
  if (str(raw.theme)) d.theme = str(raw.theme);
  if (str(raw.emotion || raw.afterReading)) d.afterReading = str(raw.emotion || raw.afterReading);

  if (raw.protagonist && raw.protagonist !== 'null') {
    d.protagonist = typeof raw.protagonist === 'string'
      ? { name: raw.protagonist, role: '', personality: '', speechStyle: '' }
      : raw.protagonist;
  }

  if (raw.characters && raw.characters !== 'null') {
    if (Array.isArray(raw.characters)) {
      d.characters = raw.characters;
    } else if (typeof raw.characters === 'string') {
      d.characters = raw.characters as any;
    }
  }

  const worldStr = str(raw.world || raw.worldBuilding);
  if (worldStr) {
    // AI sends worldBuilding as a free-text string; wrap it into structured WorldBuildingData
    d.worldBuilding = {
      basics: { era: '', setting: '', civilizationLevel: '' },
      rules: [],
      terminology: [],
      history: worldStr,
      infoAsymmetry: { commonKnowledge: '', hiddenTruths: '' },
      items: [],
    };
  }

  if (str(raw.conflict)) d.conflict = str(raw.conflict);
  if (str(raw.plot || raw.plotOutline)) d.plotOutline = str(raw.plot || raw.plotOutline);
  if (str(raw.tone)) d.tone = str(raw.tone);

  const scope = raw.scope || raw.episodeCount;
  if (scope && scope !== 'null') {
    const scopeStr = String(scope);
    const epMatch = scopeStr.match(/(\d+)\s*話/);
    const charMatch = scopeStr.match(/(\d+)\s*字/);
    if (epMatch) d.episodeCount = parseInt(epMatch[1], 10);
    if (charMatch) d.charCountPerEpisode = parseInt(charMatch[1], 10);
    if (!epMatch && !charMatch) {
      const numMatch = scopeStr.match(/(\d+)/);
      if (numMatch) d.episodeCount = parseInt(numMatch[1], 10);
    }
  }

  return d;
}
