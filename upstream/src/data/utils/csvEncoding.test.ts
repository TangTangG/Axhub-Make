import { describe, expect, it } from 'vitest';
import { decodeCsvBytes, detectBomEncoding } from './csvEncoding';

const hexToBytes = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));

describe('csvEncoding', () => {
  it('detects UTF-8 BOM', () => {
    const bytes = hexToBytes('efbbbf69642c6e616d650a312ce4b8ade696870a');
    expect(detectBomEncoding(bytes)).toEqual({ encoding: 'utf-8', offset: 3 });
  });

  it('decodes UTF-8 CSV correctly', () => {
    const bytes = hexToBytes('69642c6e616d650a312ce4b8ade696870a');
    expect(decodeCsvBytes(bytes)).toEqual({
      encoding: 'utf-8',
      text: 'id,name\n1,中文\n',
    });
  });

  it('decodes GBK CSV correctly', () => {
    const bytes = hexToBytes('69642c6e616d650a312cd6d0cec40a');
    const result = decodeCsvBytes(bytes);

    expect(result.encoding).toBe('gb18030');
    expect(result.text).toBe('id,name\n1,中文\n');
  });

  it('prefers GB18030 for Chinese CSV headers exported on Windows', () => {
    const bytes = hexToBytes('c9fab2fabcc6bbaeb1e0bac52cb8bad4f0c8cb2cb9a4d2d52cd4adc1cf0d0a31333231342cd5c5d7dc2cb0a2cbaedac02c7766777664200d0a');
    const result = decodeCsvBytes(bytes);

    expect(result.encoding).toBe('gb18030');
    expect(result.text.startsWith('生产计划编号,负责人,工艺,原料')).toBe(true);
  });

  it('decodes UTF-16LE CSV with BOM correctly', () => {
    const bytes = hexToBytes('fffe690064002c006e0061006d0065000a0031002c002d4e87650a00');
    expect(decodeCsvBytes(bytes)).toEqual({
      encoding: 'utf-16le',
      text: 'id,name\n1,中文\n',
    });
  });
});
