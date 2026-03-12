'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface PromptTemplate {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  variables: string[];
}

const CATEGORY_LABELS: Record<string, string> = {
  writing: '執筆',
  editing: '編集',
  generation: '生成',
};

const VARIABLE_LABELS: Record<string, string> = {
  content: '本文（自動入力）',
  character_name: 'キャラクター名',
  genre: 'ジャンル',
  target_style: '目標の文体',
};

// Variables that are automatically filled by the system (not shown to users)
const AUTO_VARIABLES = new Set(['content', 'context', 'char_count', 'custom_instruction', 'user_prompt']);

// Templates where content (本文) is optional — they use {{#content}} conditional blocks
const CONTENT_OPTIONAL_SLUGS = new Set(['chapter-opening', 'free-prompt']);

interface TemplateSelectorProps {
  templates: PromptTemplate[];
  onGenerate: (slug: string, variables: Record<string, string>) => void;
  isStreaming: boolean;
  currentContent: string;
}

export function TemplateSelector({ templates, onGenerate, isStreaming, currentContent }: TemplateSelectorProps) {
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});

  const selected = templates.find((t) => t.slug === selectedSlug);
  const categories = [...new Set(templates.map((t) => t.category))];

  function handleGenerate() {
    if (!selected) return;
    const vars: Record<string, string> = { ...variableValues };
    if (selected.variables.includes('content')) {
      vars.content = currentContent;
    }
    onGenerate(selected.slug, vars);
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            {CATEGORY_LABELS[cat] || cat}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {templates
              .filter((t) => t.category === cat && t.slug !== 'free-prompt')
              .map((t) => (
                <button
                  key={t.slug}
                  onClick={() => {
                    setSelectedSlug(t.slug === selectedSlug ? null : t.slug);
                    setVariableValues({});
                  }}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-full border transition-colors',
                    t.slug === selectedSlug
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-secondary border-border',
                  )}
                >
                  {t.name}
                </button>
              ))}
          </div>
        </div>
      ))}

      {selected && (
        <div className="space-y-2 pt-2 border-t">
          {selected.description && (
            <p className="text-xs text-muted-foreground">{selected.description}</p>
          )}
          {selected.variables
            .filter((v) => !AUTO_VARIABLES.has(v))
            .map((v) => (
              <div key={v}>
                <label className="text-xs text-muted-foreground">{VARIABLE_LABELS[v] || v}</label>
                <Input
                  size={1}
                  value={variableValues[v] || ''}
                  onChange={(e) => setVariableValues({ ...variableValues, [v]: e.target.value })}
                  placeholder={VARIABLE_LABELS[v] || v}
                  className="h-8 text-xs mt-0.5"
                />
              </div>
            ))}
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={
              isStreaming ||
              (!CONTENT_OPTIONAL_SLUGS.has(selected.slug) && !currentContent.trim()) ||
              selected.variables
                .filter((v) => !AUTO_VARIABLES.has(v))
                .some((v) => !variableValues[v]?.trim())
            }
            className="w-full"
          >
            {isStreaming ? '生成中...' : '生成する'}
          </Button>
        </div>
      )}
    </div>
  );
}
