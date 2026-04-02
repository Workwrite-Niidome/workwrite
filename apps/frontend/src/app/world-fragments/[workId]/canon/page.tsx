'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { worldFragmentsApi, type WorldCanon } from '@/lib/world-fragments-api';

export default function CanonEditorPage() {
  const params = useParams();
  const workId = params.workId as string;

  const [canon, setCanon] = useState<WorldCanon | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Editable fields as JSON strings for textarea editing
  const [characterProfiles, setCharacterProfiles] = useState('');
  const [worldRules, setWorldRules] = useState('');
  const [establishedFacts, setEstablishedFacts] = useState('');
  const [ambiguities, setAmbiguities] = useState('');
  const [narrativeStyle, setNarrativeStyle] = useState('');
  const [worldLayers, setWorldLayers] = useState('');
  const [layerInteractions, setLayerInteractions] = useState('');
  const [layerAmbiguities, setLayerAmbiguities] = useState('');

  useEffect(() => {
    worldFragmentsApi
      .getCanon(workId)
      .then((data) => {
        setCanon(data);
        setCharacterProfiles(JSON.stringify(data.characterProfiles, null, 2));
        setWorldRules(JSON.stringify(data.worldRules, null, 2));
        setEstablishedFacts(JSON.stringify(data.establishedFacts, null, 2));
        setAmbiguities(JSON.stringify(data.ambiguities, null, 2));
        setNarrativeStyle(JSON.stringify(data.narrativeStyle, null, 2));
        if (data.worldLayers) {
          setWorldLayers(JSON.stringify(data.worldLayers, null, 2));
        }
        if (data.layerInteractions) {
          setLayerInteractions(JSON.stringify(data.layerInteractions, null, 2));
        }
        if (data.layerAmbiguities) {
          setLayerAmbiguities(JSON.stringify(data.layerAmbiguities, null, 2));
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [workId]);

  const tryParseJson = (text: string, label: string): any | null => {
    if (!text.trim()) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`${label} のJSONが不正です。構文を確認してください。`);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const data: Record<string, any> = {};

      // Only include fields that have changed from the original
      const parsed = {
        characterProfiles: tryParseJson(characterProfiles, 'Character Profiles'),
        worldRules: tryParseJson(worldRules, 'World Rules'),
        establishedFacts: tryParseJson(establishedFacts, 'Established Facts'),
        ambiguities: tryParseJson(ambiguities, 'Ambiguities'),
        narrativeStyle: tryParseJson(narrativeStyle, 'Narrative Style'),
        worldLayers: worldLayers.trim() ? tryParseJson(worldLayers, 'World Layers') : undefined,
        layerInteractions: layerInteractions.trim() ? tryParseJson(layerInteractions, 'Layer Interactions') : undefined,
        layerAmbiguities: layerAmbiguities.trim() ? tryParseJson(layerAmbiguities, 'Layer Ambiguities') : undefined,
      };

      for (const [key, value] of Object.entries(parsed)) {
        if (value !== undefined) {
          data[key] = value;
        }
      }

      if (Object.keys(data).length === 0) {
        setError('No changes to save.');
        setSaving(false);
        return;
      }

      const updated = await worldFragmentsApi.patchCanon(workId, data);
      setCanon(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!canon) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-sm text-muted-foreground">
          {error || 'Canon not found for this work.'}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <header className="space-y-2">
          <p className="text-xs tracking-[0.3em] uppercase text-muted-foreground/60">
            Canon Editor
          </p>
          <h1 className="text-2xl font-serif font-medium tracking-tight">
            Canon v{canon.canonVersion}
          </h1>
          <p className="text-sm text-muted-foreground">
            第{canon.upToEpisode}話まで分析済み
          </p>
        </header>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="rounded-lg border border-green-300/40 bg-green-50/50 dark:bg-green-900/10 p-4 text-sm text-green-800 dark:text-green-300">
            Canon を更新しました。
          </div>
        )}

        {/* Read-only sections */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-secondary/30 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(canon.timeline, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-serif">Relationships</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs bg-secondary/30 rounded-lg p-4 overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(canon.relationships, null, 2)}
            </pre>
          </CardContent>
        </Card>

        {/* Editable sections */}
        <CanonTextarea
          label="Character Profiles"
          value={characterProfiles}
          onChange={setCharacterProfiles}
        />

        <CanonTextarea
          label="World Rules"
          value={worldRules}
          onChange={setWorldRules}
        />

        <CanonTextarea
          label="Established Facts"
          value={establishedFacts}
          onChange={setEstablishedFacts}
        />

        <CanonTextarea
          label="Ambiguities"
          value={ambiguities}
          onChange={setAmbiguities}
        />

        <CanonTextarea
          label="Narrative Style"
          value={narrativeStyle}
          onChange={setNarrativeStyle}
        />

        <CanonTextarea
          label="World Layers"
          value={worldLayers}
          onChange={setWorldLayers}
          optional
        />

        <CanonTextarea
          label="Layer Interactions"
          value={layerInteractions}
          onChange={setLayerInteractions}
          optional
        />

        <CanonTextarea
          label="Layer Ambiguities"
          value={layerAmbiguities}
          onChange={setLayerAmbiguities}
          optional
        />

        {/* Save button */}
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="font-serif"
          >
            {saving ? '保存中...' : 'Canon を保存'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CanonTextarea({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  optional?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-serif">
          {label}
          {optional && <span className="text-xs text-muted-foreground ml-2">(optional)</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-4 py-3 text-xs font-mono placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none resize-y"
          rows={12}
          placeholder={optional ? 'JSON (optional)' : 'JSON'}
        />
      </CardContent>
    </Card>
  );
}
