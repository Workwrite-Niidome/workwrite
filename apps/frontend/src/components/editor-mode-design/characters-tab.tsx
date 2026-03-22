'use client';

import { Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import type { DesignData } from './types';

interface Props {
  design: DesignData;
  onChange: (d: Partial<DesignData>) => void;
}

interface CharacterObj {
  name: string;
  role: string;
  personality: string;
  speechStyle: string;
}

function CharacterCard({
  character,
  label,
  onChange,
  onDelete,
}: {
  character: CharacterObj;
  label: string;
  onChange: (updated: CharacterObj) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {onDelete && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">名前</label>
          <Input
            value={character.name}
            onChange={(e) => onChange({ ...character, name: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">役割</label>
          <Input
            value={character.role}
            onChange={(e) => onChange({ ...character, role: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">性格</label>
          <Input
            value={character.personality}
            onChange={(e) => onChange({ ...character, personality: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-muted-foreground">口調</label>
          <Input
            value={character.speechStyle}
            onChange={(e) => onChange({ ...character, speechStyle: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
      </div>
    </div>
  );
}

export function CharactersTab({ design, onChange }: Props) {
  const hasProtagonist = !!design.protagonist;
  const hasCharacters = !!design.characters;
  const hasContent = hasProtagonist || hasCharacters;

  const handleAddCharacter = () => {
    const current = Array.isArray(design.characters) ? design.characters : [];
    onChange({
      characters: [...current, { name: '', role: '', personality: '', speechStyle: '' }],
    });
  };

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-3">
          <Users className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          キャラクター設定がまだありません
        </p>
        <Button variant="outline" size="sm" onClick={handleAddCharacter} className="gap-1">
          <Plus className="h-3 w-3" /> キャラクターを追加
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Protagonist */}
      {design.protagonist && typeof design.protagonist === 'object' && (
        <CharacterCard
          character={design.protagonist}
          label="主人公"
          onChange={(updated) => onChange({ protagonist: updated })}
        />
      )}
      {design.protagonist && typeof design.protagonist === 'string' && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">主人公</p>
            <p className="text-sm">{design.protagonist}</p>
          </CardContent>
        </Card>
      )}

      {/* Characters as string */}
      {typeof design.characters === 'string' && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground mb-1">キャラクター</p>
            <p className="text-sm whitespace-pre-wrap">{design.characters}</p>
          </CardContent>
        </Card>
      )}

      {/* Characters as array */}
      {Array.isArray(design.characters) &&
        design.characters.map((char, idx) => (
          <CharacterCard
            key={idx}
            character={char}
            label={`キャラクター ${idx + 1}`}
            onChange={(updated) => {
              const newChars = [...(design.characters as CharacterObj[])];
              newChars[idx] = updated;
              onChange({ characters: newChars });
            }}
            onDelete={() => {
              const newChars = (design.characters as CharacterObj[]).filter((_, i) => i !== idx);
              onChange({ characters: newChars });
            }}
          />
        ))}

      <Button variant="outline" size="sm" onClick={handleAddCharacter} className="w-full gap-1">
        <Plus className="h-3 w-3" /> キャラクターを追加
      </Button>
    </div>
  );
}
