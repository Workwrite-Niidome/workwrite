import * as jschardet from 'jschardet';
import * as iconv from 'iconv-lite';

export function decodeBuffer(buffer: Buffer): {
  text: string;
  detectedEncoding: string;
} {
  const detected = jschardet.detect(buffer);
  const encoding = detected.encoding || 'UTF-8';
  const text = iconv.decode(buffer, encoding);
  // BOM除去
  return { text: text.replace(/^\uFEFF/, ''), detectedEncoding: encoding };
}
