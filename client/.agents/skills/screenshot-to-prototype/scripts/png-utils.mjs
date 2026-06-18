import fs from 'node:fs';
import zlib from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

export function readPng(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`Unsupported PNG signature: ${filePath}`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Only 8-bit RGB/RGBA PNG files are supported: ${filePath}`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const bytesPerPixel = channels;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const raw = Buffer.alloc(height * stride);
  let inputOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const rowOffset = y * stride;
    const prevRowOffset = (y - 1) * stride;

    for (let x = 0; x < stride; x += 1) {
      const value = inflated[inputOffset + x];
      const left = x >= bytesPerPixel ? raw[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[prevRowOffset + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[prevRowOffset + x - bytesPerPixel] : 0;

      if (filter === 0) raw[rowOffset + x] = value;
      else if (filter === 1) raw[rowOffset + x] = (value + left) & 255;
      else if (filter === 2) raw[rowOffset + x] = (value + up) & 255;
      else if (filter === 3) raw[rowOffset + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) raw[rowOffset + x] = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error(`Unsupported PNG filter ${filter}: ${filePath}`);
    }
    inputOffset += stride;
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const sourceOffset = index * channels;
    const targetOffset = index * 4;
    rgba[targetOffset] = raw[sourceOffset];
    rgba[targetOffset + 1] = raw[sourceOffset + 1];
    rgba[targetOffset + 2] = raw[sourceOffset + 2];
    rgba[targetOffset + 3] = colorType === 6 ? raw[sourceOffset + 3] : 255;
  }

  return { width, height, data: rgba, hasAlphaChannel: colorType === 6 };
}

export function writePng(filePath, image) {
  const { width, height, data } = image;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (1 + width * 4);
    scanlines[rowStart] = 0;
    data.copy(scanlines, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  fs.writeFileSync(filePath, Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]));
}

export function cropPng(image, bbox) {
  const width = Math.max(0, bbox.width);
  const height = Math.max(0, bbox.height);
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((bbox.y + y) * image.width + bbox.x) * 4;
    const targetStart = y * width * 4;
    image.data.copy(data, targetStart, sourceStart, sourceStart + width * 4);
  }
  return { width, height, data, hasAlphaChannel: true };
}

export function findAlphaBounds(image, bounds = { x: 0, y: 0, width: image.width, height: image.height }, alphaThreshold = 8) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  const startX = Math.max(0, bounds.x);
  const startY = Math.max(0, bounds.y);
  const endX = Math.min(image.width, bounds.x + bounds.width);
  const endY = Math.min(image.height, bounds.y + bounds.height);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] > alphaThreshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

export function expandBounds(bounds, padding, image) {
  const x = Math.max(0, bounds.x - padding);
  const y = Math.max(0, bounds.y - padding);
  const right = Math.min(image.width, bounds.x + bounds.width + padding);
  const bottom = Math.min(image.height, bounds.y + bounds.height + padding);
  return { x, y, width: right - x, height: bottom - y };
}
