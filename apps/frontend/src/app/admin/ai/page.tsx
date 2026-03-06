'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

interface AiSetting {
  key: string;
  value: string;
  encrypted: boolean;
  updatedAt: string;
}

interface UsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface DailyUsage {
  date: string;
  requests: number;
  tokens: number;
}

export default function AdminAiPage() {
  const [settings, setSettings] = useState<AiSetting[]>([]);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [aiEnabled, setAiEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [settingsRes, usageRes, dailyRes] = await Promise.all([
        api.getAiSettings(),
        api.getAiUsage(),
        api.getAiUsageDaily(),
      ]);
      setSettings(settingsRes.data);
      setUsage(usageRes.data);
      setDailyUsage(dailyRes.data);

      // Populate form from settings
      const modelSetting = settingsRes.data.find((s: AiSetting) => s.key === 'ai.model');
      if (modelSetting) setModel(modelSetting.value);
      const enabledSetting = settingsRes.data.find((s: AiSetting) => s.key === 'ai.enabled');
      if (enabledSetting) setAiEnabled(enabledSetting.value === 'true');
    } catch {
      // ignore
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    try {
      if (apiKey.trim()) {
        await api.updateAiSetting('ai.api_key', apiKey, true);
      }
      await api.updateAiSetting('ai.model', model);
      await api.updateAiSetting('ai.enabled', aiEnabled ? 'true' : 'false');
      setMessage('設定を保存しました');
      setApiKey('');
      await loadData();
    } catch {
      setMessage('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const totalTokens = usage ? usage.totalInputTokens + usage.totalOutputTokens : 0;
  // Rough cost estimate (Sonnet pricing: ~$3/1M input, ~$15/1M output)
  const estimatedCost = usage
    ? (usage.totalInputTokens * 3 + usage.totalOutputTokens * 15) / 1_000_000
    : 0;
  const maxDailyTokens = Math.max(...dailyUsage.map((d) => d.tokens), 1);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">AI Settings</h2>

      {/* Settings form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">API設定</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">APIキー</label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings.find((s) => s.key === 'ai.api_key') ? '••••••••（設定済み）' : 'sk-ant-...'}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Anthropic Claude APIキー。空のまま保存すると変更されません。
            </p>
          </div>

          <div>
            <label className="text-sm font-medium">モデル</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full border rounded-md px-3 py-2 text-sm bg-background"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              <option value="claude-opus-4-6">Claude Opus 4.6</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="ai-enabled"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="ai-enabled" className="text-sm">AI機能を有効にする</label>
          </div>

          {message && (
            <p className={`text-sm ${message.includes('失敗') ? 'text-destructive' : 'text-green-600'}`}>
              {message}
            </p>
          )}

          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '設定を保存'}
          </Button>
        </CardContent>
      </Card>

      {/* Usage stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">総リクエスト数</p>
            <p className="text-2xl font-bold">{usage?.totalRequests.toLocaleString() ?? '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">総トークン数</p>
            <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">推定コスト</p>
            <p className="text-2xl font-bold">${estimatedCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily usage chart */}
      {dailyUsage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">日次利用状況（トークン数）</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {dailyUsage.slice(-30).map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full bg-primary/80 rounded-t-sm min-h-[2px]"
                    style={{ height: `${(d.tokens / maxDailyTokens) * 100}%` }}
                    title={`${d.date}: ${d.tokens.toLocaleString()} tokens, ${d.requests} requests`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
              <span>{dailyUsage[0]?.date}</span>
              <span>{dailyUsage[dailyUsage.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
