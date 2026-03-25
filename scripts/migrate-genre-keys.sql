-- Migrate genre values to standardized English keys
-- Covers: Japanese labels, import values, uppercase legacy values, compound values

BEGIN;

-- Japanese labels → English keys
UPDATE "Work" SET genre = 'fantasy'    WHERE genre IN ('ファンタジー', 'ハイファンタジー', 'ローファンタジー', '異世界ファンタジー', '現代ファンタジー');
UPDATE "Work" SET genre = 'sf'         WHERE genre IN ('SF', '空想科学');
UPDATE "Work" SET genre = 'mystery'    WHERE genre = 'ミステリー';
UPDATE "Work" SET genre = 'romance'    WHERE genre IN ('恋愛', '異世界〔恋愛〕', '現実世界〔恋愛〕');
UPDATE "Work" SET genre = 'horror'     WHERE genre = 'ホラー';
UPDATE "Work" SET genre = 'literary'   WHERE genre IN ('純文学', '文芸');
UPDATE "Work" SET genre = 'adventure'  WHERE genre = '冒険';
UPDATE "Work" SET genre = 'comedy'     WHERE genre IN ('コメディ', 'コメディー');
UPDATE "Work" SET genre = 'drama'      WHERE genre IN ('ヒューマンドラマ', 'ドラマ');
UPDATE "Work" SET genre = 'historical' WHERE genre IN ('歴史', '歴史・時代');
UPDATE "Work" SET genre = 'modern'     WHERE genre = '現代';
UPDATE "Work" SET genre = 'youth'      WHERE genre = '青春';
UPDATE "Work" SET genre = 'other'      WHERE genre IN ('その他', '童話', 'エッセイ');

-- Uppercase legacy values → English keys
UPDATE "Work" SET genre = 'fantasy'    WHERE genre = 'FANTASY';
UPDATE "Work" SET genre = 'romance'    WHERE genre IN ('LOVE_STORY', 'ROMANCE');
UPDATE "Work" SET genre = 'adventure'  WHERE genre = 'ACTION';

-- Compound/comma-separated → pick primary genre
UPDATE "Work" SET genre = 'drama'      WHERE genre LIKE '%現代ドラマ%';

-- Empty string → null (cleaner than empty)
UPDATE "Work" SET genre = NULL WHERE genre = '';

COMMIT;
