import Papa from 'papaparse';

type SupportedEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'gb18030' | 'gbk';

interface BomEncoding {
  encoding: SupportedEncoding;
  offset: number;
}

interface DecodedCandidate {
  encoding: SupportedEncoding;
  text: string;
  score: number;
}

export interface DecodedCsvResult {
  encoding: SupportedEncoding;
  text: string;
}

const CANDIDATE_ENCODINGS: SupportedEncoding[] = ['utf-8', 'gb18030', 'gbk', 'utf-16le', 'utf-16be'];
const MOJIBAKE_FRAGMENTS = ['锘', '锟', '涓', '鏂', '鐨', '鍚', '鍙', '璇', '鈥', 'Ã', 'Â', 'æ', 'ä¸', 'å'];

export const detectBomEncoding = (bytes: Uint8Array): BomEncoding | null => {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: 'utf-8', offset: 3 };
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: 'utf-16le', offset: 2 };
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: 'utf-16be', offset: 2 };
  }

  return null;
};

const countMatches = (text: string, pattern: RegExp): number => {
  const matches = text.match(pattern);
  return matches?.length ?? 0;
};

const countMojibakeFragments = (text: string): number => {
  return MOJIBAKE_FRAGMENTS.reduce((count, fragment) => {
    if (!fragment) return count;
    return count + text.split(fragment).length - 1;
  }, 0);
};

const countCsvDelimiters = (text: string): number => {
  return countMatches(text, /,/g) + countMatches(text, /\r?\n/g);
};

const countUnlikelyChars = (text: string): number => {
  const matches = text.match(/[^\t\n\r\u0020-\u007E\u00A0-\u00FF\u2000-\u206F\u3000-\u303F\u3400-\u9FFF\uF900-\uFAFF]/g);
  return matches?.length ?? 0;
};

const scoreDecodedText = (text: string): number => {
  if (!text.trim()) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  score -= countMatches(text, /\uFFFD/g) * 120;
  score -= countMatches(text, /\u0000/g) * 80;
  score -= countMatches(text, /[\uE000-\uF8FF]/g) * 60;
  score -= countMatches(text, /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g) * 40;
  score -= countMojibakeFragments(text) * 12;
  score -= countUnlikelyChars(text) * 10;
  score += Math.min(countMatches(text, /[\u3400-\u9FFF]/g), 32) * 3;
  score += Math.min(countCsvDelimiters(text), 64) * 5;

  const previewParse = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    preview: 5,
    transformHeader: (header) => header.trim(),
  });

  if (previewParse.errors.length === 0) {
    score += 24;
  } else {
    score -= previewParse.errors.length * 15;
  }

  const firstRow = previewParse.data[0];
  if (firstRow) {
    const headers = Object.keys(firstRow).filter((key) => key.trim() !== '');
    score += headers.length > 1 ? headers.length * 12 : -20;

    const populatedCells = Object.values(firstRow).filter((value) => {
      return String(value ?? '').trim() !== '';
    });
    score += populatedCells.length * 4;
  }

  return score;
};

const decodeCandidate = (bytes: Uint8Array, encoding: SupportedEncoding): string | null => {
  try {
    if (encoding === 'utf-8') {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    }

    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return null;
  }
};

export const decodeCsvBytes = (bytes: Uint8Array): DecodedCsvResult => {
  const bom = detectBomEncoding(bytes);
  if (bom) {
    return {
      encoding: bom.encoding,
      text: new TextDecoder(bom.encoding).decode(bytes.subarray(bom.offset)),
    };
  }

  const candidates: DecodedCandidate[] = [];

  for (const encoding of CANDIDATE_ENCODINGS) {
    const text = decodeCandidate(bytes, encoding);
    if (text == null) continue;

    candidates.push({
      encoding,
      text,
      score: scoreDecodedText(text),
    });
  }

  if (candidates.length === 0) {
    return {
      encoding: 'utf-8',
      text: new TextDecoder('utf-8').decode(bytes),
    };
  }

  candidates.sort((left, right) => right.score - left.score);
  return {
    encoding: candidates[0].encoding,
    text: candidates[0].text,
  };
};
