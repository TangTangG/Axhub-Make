// src/export-core/dom/html-to-figma/helpers/parsers.js
var parseUnits = (str) => {
  if (!str) {
    return null;
  }
  const match = str.match(/([\d\.]+(?:e[+-]?\d+)?)px/i);
  const val = match === null || match === void 0 ? void 0 : match[1];
  if (val) {
    return {
      unit: "PIXELS",
      value: parseFloat(val)
    };
  }
  return null;
};
var parseBorderRadius = (str, elementWidth = 0, elementHeight = 0) => {
  if (!str) {
    return null;
  }
  const pxMatch = str.match(/([\d\.]+(?:e[+-]?\d+)?)px/i);
  if (pxMatch) {
    const value = parseFloat(pxMatch[1]);
    const maxRadius = 1e4;
    return {
      unit: "PIXELS",
      value: Math.min(value, maxRadius)
    };
  }
  const percentMatch = str.match(/([\d\.]+(?:e[+-]?\d+)?)%/i);
  if (percentMatch) {
    const percentValue = parseFloat(percentMatch[1]);
    const maxDimension = Math.max(elementWidth, elementHeight);
    const value = percentValue / 100 * maxDimension;
    const maxRadius = 1e4;
    return {
      unit: "PIXELS",
      value: Math.min(value, maxRadius)
    };
  }
  const numberMatch = str.match(/^([\d\.]+(?:e[+-]?\d+)?)$/i);
  if (numberMatch) {
    const value = parseFloat(numberMatch[1]);
    const maxRadius = 1e4;
    return {
      unit: "PIXELS",
      value: Math.min(value, maxRadius)
    };
  }
  return null;
};
function labToRgb(L, a, b) {
  let y = (L + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  const xyzTransform = (t) => {
    return t > 0.206897 ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;
  };
  x = xyzTransform(x) * 95.047;
  y = xyzTransform(y) * 100;
  z = xyzTransform(z) * 108.883;
  x = x / 100;
  y = y / 100;
  z = z / 100;
  let r = x * 3.2406 + y * -1.5372 + z * -0.4986;
  let g = x * -0.9689 + y * 1.8758 + z * 0.0415;
  let bl = x * 0.0557 + y * -0.204 + z * 1.057;
  const srgbTransform = (c) => {
    return c > 31308e-7 ? 1.055 * Math.pow(c, 1 / 2.4) - 0.055 : 12.92 * c;
  };
  r = srgbTransform(r);
  g = srgbTransform(g);
  bl = srgbTransform(bl);
  r = Math.max(0, Math.min(1, r));
  g = Math.max(0, Math.min(1, g));
  bl = Math.max(0, Math.min(1, bl));
  return { r, g, b: bl };
}
var clamp01 = (value) => Math.max(0, Math.min(1, value));
var parseNumberToken = (token, percentScale = null) => {
  if (typeof token !== "string") {
    return null;
  }
  const trimmed = token.trim();
  const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%)?$/i);
  if (!match) {
    return null;
  }
  let value = parseFloat(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  if (match[2]) {
    if (percentScale === null) {
      return null;
    }
    value = value / 100 * percentScale;
  }
  return value;
};
var parseAlphaToken = (token) => {
  if (token === void 0 || token === null || token === "") {
    return 1;
  }
  const value = parseNumberToken(token, 1);
  if (value === null) {
    return null;
  }
  return clamp01(value);
};
var parseOklabLightness = (token) => {
  if (typeof token !== "string") {
    return null;
  }
  const trimmed = token.trim();
  const isPercent = trimmed.endsWith("%");
  const value = parseNumberToken(trimmed, 1);
  if (value === null) {
    return null;
  }
  if (!isPercent && (value < 0 || value > 1)) {
    return null;
  }
  return clamp01(value);
};
var parseHueToken = (token) => {
  if (typeof token !== "string") {
    return null;
  }
  const trimmed = token.trim().toLowerCase();
  const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/);
  if (!match) {
    return null;
  }
  let value = parseFloat(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }
  const unit = match[2] || "deg";
  if (unit === "rad") {
    value = value * 180 / Math.PI;
  } else if (unit === "grad") {
    value = value * 0.9;
  } else if (unit === "turn") {
    value = value * 360;
  }
  const normalized = (value % 360 + 360) % 360;
  return normalized;
};
var parseSpaceSeparatedColorArgs = (colorBody) => {
  const slashParts = colorBody.split("/");
  if (slashParts.length > 2) {
    return null;
  }
  const channels = slashParts[0].trim().split(/[\s,]+/).filter(Boolean);
  if (channels.length !== 3) {
    return null;
  }
  const alpha = parseAlphaToken(slashParts[1] ? slashParts[1].trim() : void 0);
  if (alpha === null) {
    return null;
  }
  return { channels, alpha };
};
function oklchToOklab(L, C, H) {
  const rad = H * Math.PI / 180;
  return {
    L,
    a: C * Math.cos(rad),
    b: C * Math.sin(rad)
  };
}
function oklabToLinearSrgb(L, a, b) {
  const l = L + 0.3963377774 * a + 0.2158037573 * b;
  const m = L - 0.1055613458 * a - 0.0638541728 * b;
  const s = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l * l * l;
  const m3 = m * m * m;
  const s3 = s * s * s;
  return {
    r: 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    g: -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    b: -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3
  };
}
function linearSrgbToSrgb(c) {
  if (c <= 31308e-7) {
    return 12.92 * c;
  }
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
function oklabToSrgb(L, a, b) {
  const linear = oklabToLinearSrgb(L, a, b);
  return {
    r: clamp01(linearSrgbToSrgb(linear.r)),
    g: clamp01(linearSrgbToSrgb(linear.g)),
    b: clamp01(linearSrgbToSrgb(linear.b))
  };
}
function oklchToSrgb(L, C, H) {
  const oklab = oklchToOklab(L, C, H);
  return oklabToSrgb(oklab.L, oklab.a, oklab.b);
}
var parseOklabColor = (colorString) => {
  const match = colorString.match(/^oklab\(\s*([^)]+)\s*\)$/i);
  if (!match) {
    return null;
  }
  const parsed = parseSpaceSeparatedColorArgs(match[1]);
  if (!parsed) {
    return null;
  }
  const L = parseOklabLightness(parsed.channels[0]);
  const a = parseNumberToken(parsed.channels[1], 1);
  const b = parseNumberToken(parsed.channels[2], 1);
  if (L === null || a === null || b === null) {
    return null;
  }
  const rgb = oklabToSrgb(L, a, b);
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: parsed.alpha
  };
};
var parseOklchColor = (colorString) => {
  const match = colorString.match(/^oklch\(\s*([^)]+)\s*\)$/i);
  if (!match) {
    return null;
  }
  const parsed = parseSpaceSeparatedColorArgs(match[1]);
  if (!parsed) {
    return null;
  }
  const L = parseOklabLightness(parsed.channels[0]);
  const C = parseNumberToken(parsed.channels[1], 1);
  const H = parseHueToken(parsed.channels[2]);
  if (L === null || C === null || H === null) {
    return null;
  }
  const rgb = oklchToSrgb(L, C, H);
  return {
    r: rgb.r,
    g: rgb.g,
    b: rgb.b,
    a: parsed.alpha
  };
};
function getRgb(colorString) {
  if (!colorString) {
    return null;
  }
  const normalizedColor = colorString.trim();
  if (normalizedColor.toLowerCase() === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }
  const oklchColor = parseOklchColor(normalizedColor);
  if (oklchColor) {
    return oklchColor;
  }
  const oklabColor = parseOklabColor(normalizedColor);
  if (oklabColor) {
    return oklabColor;
  }
  const labMatch = normalizedColor.match(
    /^lab\(\s*([0-9.]+%?)\s+([+-]?[0-9.]+)\s+([+-]?[0-9.]+)(?:\s*\/\s*([0-9.]+%?))?\s*\)$/i
  );
  if (labMatch) {
    const L = parseFloat(labMatch[1]);
    const a = parseFloat(labMatch[2]);
    const b = parseFloat(labMatch[3]);
    let finalAlpha = 1;
    if (labMatch[4]) {
      const alphaValue = parseFloat(labMatch[4]);
      finalAlpha = labMatch[4].includes("%") ? alphaValue / 100 : alphaValue;
    }
    const rgb = labToRgb(L, a, b);
    return {
      r: rgb.r,
      g: rgb.g,
      b: rgb.b,
      a: finalAlpha
    };
  }
  const rgbaMatch = normalizedColor.match(
    /rgba?\(([\d\.]+),\s*([\d\.]+),\s*([\d\.]+)(?:,\s*([\d\.]+))?\)/
  );
  if (rgbaMatch) {
    const [_1, r, g, b, a] = rgbaMatch;
    if (r && g && b) {
      return {
        r: parseInt(r) / 255,
        g: parseInt(g) / 255,
        b: parseInt(b) / 255,
        a: a ? parseFloat(a) : 1
      };
    }
  }
  const hexMatch = normalizedColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split("").map((c) => c + c).join("");
    }
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: 1
    };
  }
  return null;
}
var LENGTH_REG = /^[0-9]+[a-zA-Z%]+?$/;
var toNum = (v) => {
  if (!/px$/.test(v) && v !== "0") return 0;
  const n = parseFloat(v);
  return !isNaN(n) ? n : 0;
};
var isLength = (v) => v === "0" || LENGTH_REG.test(v);
var LEADING_COLOR_TOKEN_REG = /^(transparent|currentcolor|#[0-9a-f]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\([^)]*\))\s+/i;
var moveLeadingColorToTail = (shadowStr) => {
  const colorMatch = shadowStr.match(LEADING_COLOR_TOKEN_REG);
  if (!colorMatch) {
    return shadowStr;
  }
  const colorToken = colorMatch[1];
  const rest = shadowStr.slice(colorMatch[0].length).trim();
  if (!rest) {
    return shadowStr;
  }
  return `${rest} ${colorToken}`.trim();
};
var parseSingleShadow = (shadowStr) => {
  shadowStr = moveLeadingColorToTail(shadowStr);
  const PARTS_REG = /\s(?![^(]*\))/;
  const parts = shadowStr.split(PARTS_REG);
  const inset = parts.includes("inset");
  const last = parts.slice(-1)[0];
  const color = !isLength(last) ? last : "rgba(0, 0, 0, 1)";
  const nums = parts.filter((n) => n !== "inset").filter((n) => n !== color).map(toNum);
  const [offsetX = 0, offsetY = 0, blurRadius = 0, spreadRadius = 0] = nums;
  return {
    inset,
    offsetX,
    offsetY,
    blurRadius,
    spreadRadius,
    color
  };
};
var parseBoxShadowStr = (str) => {
  if (!str || str === "none") {
    return [];
  }
  const shadows = [];
  let currentShadow = "";
  let parenCount = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "(") {
      parenCount++;
    } else if (char === ")") {
      parenCount--;
    } else if (char === "," && parenCount === 0) {
      if (currentShadow.trim()) {
        shadows.push(parseSingleShadow(currentShadow.trim()));
        currentShadow = "";
        continue;
      }
    }
    currentShadow += char;
  }
  if (currentShadow.trim()) {
    shadows.push(parseSingleShadow(currentShadow.trim()));
  }
  return shadows;
};
var parseSingleTextShadow = (shadowStr) => {
  shadowStr = moveLeadingColorToTail(shadowStr);
  const PARTS_REG = /\s(?![^(]*\))/;
  const parts = shadowStr.split(PARTS_REG);
  const last = parts.slice(-1)[0];
  const color = !isLength(last) ? last : "rgba(0, 0, 0, 1)";
  const nums = parts.filter((n) => n !== color).map(toNum);
  const [offsetX = 0, offsetY = 0, blurRadius = 0] = nums;
  return {
    offsetX,
    offsetY,
    blurRadius,
    color
  };
};
var parseTextShadowStr = (str) => {
  if (!str || str === "none") {
    return [];
  }
  const shadows = [];
  let currentShadow = "";
  let parenCount = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "(") {
      parenCount++;
    } else if (char === ")") {
      parenCount--;
    } else if (char === "," && parenCount === 0) {
      if (currentShadow.trim()) {
        shadows.push(parseSingleTextShadow(currentShadow.trim()));
        currentShadow = "";
        continue;
      }
    }
    currentShadow += char;
  }
  if (currentShadow.trim()) {
    shadows.push(parseSingleTextShadow(currentShadow.trim()));
  }
  return shadows;
};
var parseFilterStr = (str) => {
  if (!str || str === "none") {
    return [];
  }
  const filters = [];
  const filterRegex = /(\w+)\(([^)]+)\)/g;
  let match;
  while ((match = filterRegex.exec(str)) !== null) {
    const [, filterType, value] = match;
    switch (filterType) {
      case "blur":
        const blurValue = parseFloat(value);
        if (!isNaN(blurValue)) {
          filters.push({
            type: "LAYER_BLUR",
            radius: blurValue,
            visible: true
          });
        }
        break;
      case "brightness":
      case "contrast":
      case "saturate":
      case "hue-rotate":
      case "invert":
      case "sepia":
      case "opacity":
        filters.push({
          type: "CUSTOM_FILTER",
          filterType,
          value: parseFloat(value) || 1,
          visible: true
        });
        break;
    }
  }
  return filters;
};
var parseBackdropFilterStr = (str) => {
  if (!str || str === "none") {
    return [];
  }
  const filters = [];
  const filterRegex = /(\w+)\(([^)]+)\)/g;
  let match;
  while ((match = filterRegex.exec(str)) !== null) {
    const [, filterType, value] = match;
    if (filterType === "blur") {
      const blurValue = parseFloat(value);
      if (!isNaN(blurValue)) {
        filters.push({
          type: "BACKGROUND_BLUR",
          radius: blurValue,
          visible: true
        });
      }
    }
  }
  return filters;
};

// src/export-core/dom/html-to-figma/helpers/image-utils.js
var ImageNameGenerator = class {
  constructor() {
    this.counter = 0;
    this.nameCache = /* @__PURE__ */ new Map();
  }
  /**
   * 生成简短的图片文件名
   * @param {string} type - 图片类型 ('img', 'bg', 'svg')
   * @param {string} extension - 文件扩展名
   * @returns {string} 简短的文件名
   */
  generateName(type = "img", extension = "png") {
    this.counter++;
    const typeMap = {
      img: "i",
      bg: "b",
      svg: "s",
      icon: "c",
      logo: "l"
    };
    const shortType = typeMap[type] || "i";
    const name = `${shortType}${this.counter}.${extension}`;
    this.nameCache.set(name, true);
    return name;
  }
  /**
   * 根据图片内容生成描述性名称
   * @param {string} src - 图片源地址
   * @param {string} type - 图片类型
   * @param {string} extension - 文件扩展名
   * @returns {string} 描述性文件名
   */
  generateDescriptiveName(src, type = "img", extension = "png") {
    let baseName = "";
    if (src && typeof src === "string") {
      const urlParts = src.split("/").pop()?.split("?")[0];
      if (urlParts && urlParts.includes(".")) {
        const nameWithoutExt = urlParts.split(".")[0];
        baseName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, "").substring(0, 8);
      }
    }
    if (!baseName) {
      const typeMap = {
        img: "i",
        bg: "b",
        svg: "s",
        icon: "c",
        logo: "l"
      };
      baseName = typeMap[type] || "i";
    }
    this.counter++;
    const name = `${baseName}${this.counter}.${extension}`;
    let finalName = name;
    let counter = 1;
    while (this.nameCache.has(finalName)) {
      finalName = `${baseName}${this.counter}_${counter}.${extension}`;
      counter++;
    }
    this.nameCache.set(finalName, true);
    return finalName;
  }
  /**
   * 重置计数器（用于新的页面处理）
   */
  reset() {
    this.counter = 0;
    this.nameCache.clear();
  }
};
var imageNameGenerator = new ImageNameGenerator();
async function loadImageAsBase64(url) {
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors"
    });
    const blob = await response.blob();
    const contentType = blob.type;
    if (contentType !== "image/png" && contentType !== "image/jpeg") {
      return await imgToPng(await blobToBase64(blob), contentType);
    } else {
      return `data:${contentType};base64,${await blobToBase64(blob)}`;
    }
  } catch (error) {
    console.error("Failed to load image as base64:", error);
    return null;
  }
}
var isDataUrl = (value) => typeof value === "string" && value.startsWith("data:");
var toAbsoluteUrl = (url) => {
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return url;
  }
};
var getResourceContentAsDataUrl = async (fullUrl) => {
  const canUseChrome = typeof globalThis !== "undefined" && globalThis.chrome?.runtime?.sendMessage;
  if (!canUseChrome) {
    return null;
  }
  try {
    const res = await Promise.race([
      globalThis.chrome.runtime.sendMessage({
        type: "getResourceContent",
        src: fullUrl
      }),
      new Promise((resolve) => setTimeout(() => resolve(null), 8e3))
    ]);
    if (!res?.data?.content) {
      return null;
    }
    const mimeType = res.data.mimeType || "application/octet-stream";
    const content = res.data.content;
    if (res.data.base64Encoded) {
      if (mimeType === "image/webp") {
        try {
          return await imgToPng(content, mimeType);
        } catch {
        }
      }
      return `data:${mimeType};base64,${content}`;
    }
    if (typeof content === "string" && mimeType.includes("svg")) {
      return `data:${mimeType};utf8,${encodeURIComponent(content)}`;
    }
    return null;
  } catch {
    return null;
  }
};
var convertUrlToDataUrl = async (url) => {
  if (!url) {
    return url;
  }
  if (isDataUrl(url)) {
    return await normalizeDataUrlForFigma(url);
  }
  const fullUrl = toAbsoluteUrl(url);
  const fromDebugger = await getResourceContentAsDataUrl(fullUrl);
  if (fromDebugger) {
    return fromDebugger;
  }
  return await loadImageAsBase64(fullUrl);
};
var getDataUrlMimeType = (dataUrl) => {
  const match = /^data:([^;,]+)/i.exec(dataUrl || "");
  return (match && match[1] ? match[1].toLowerCase() : "").trim();
};
var isFigmaSupportedImageMime = (mimeType) => mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg" || mimeType === "image/gif";
var dataUrlToPng = (dataUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => reject(new Error("Image load timeout")), 1e4);
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (error) {
        reject(error);
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("Failed to load data URL image"));
    };
    img.src = dataUrl;
  });
};
var normalizeDataUrlForFigma = async (dataUrl) => {
  if (!isDataUrl(dataUrl)) {
    return dataUrl;
  }
  const mimeType = getDataUrlMimeType(dataUrl);
  if (!mimeType || isFigmaSupportedImageMime(mimeType)) {
    return dataUrl;
  }
  if (!mimeType.startsWith("image/")) {
    return dataUrl;
  }
  try {
    return await dataUrlToPng(dataUrl);
  } catch (_) {
    return dataUrl;
  }
};
var extractCssUrlTokens = (backgroundImage) => {
  const tokens = [];
  if (!backgroundImage || backgroundImage === "none") {
    return tokens;
  }
  const regex = /url\((['"]?)(.*?)\1\)/g;
  let match;
  while ((match = regex.exec(backgroundImage)) !== null) {
    const rawUrl = (match[2] || "").trim();
    if (!rawUrl) continue;
    tokens.push({
      fullMatch: match[0],
      rawUrl
    });
  }
  return tokens;
};
var clearResponsiveImageAttrs = (img) => {
  img.removeAttribute("srcset");
  img.removeAttribute("sizes");
  img.srcset = "";
  img.sizes = "";
  if (img.parentElement instanceof HTMLPictureElement) {
    const sources = img.parentElement.querySelectorAll("source");
    sources.forEach((source) => {
      source.removeAttribute("srcset");
      source.removeAttribute("sizes");
    });
  }
};
async function convertBackgroundImagesInPage(element) {
  const nodes = [element, ...Array.from(element.querySelectorAll("*"))];
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    let computedStyle;
    try {
      computedStyle = window.getComputedStyle(node);
    } catch {
      continue;
    }
    const backgroundImage = computedStyle.backgroundImage;
    if (!backgroundImage || backgroundImage === "none") {
      continue;
    }
    const tokens = extractCssUrlTokens(backgroundImage);
    if (tokens.length === 0) {
      continue;
    }
    let nextBackgroundImage = backgroundImage;
    let changed = false;
    for (const token of tokens) {
      const dataUrl = await convertUrlToDataUrl(token.rawUrl);
      if (!dataUrl || !isDataUrl(dataUrl)) {
        continue;
      }
      const replacement = `url("${dataUrl}")`;
      if (nextBackgroundImage.includes(token.fullMatch)) {
        nextBackgroundImage = nextBackgroundImage.replace(token.fullMatch, replacement);
        changed = true;
      }
    }
    if (changed) {
      node.style.setProperty("background-image", nextBackgroundImage, "important");
    }
  }
}
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function imgToPng(base64, mimeType) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      reject(new Error("Image load timeout"));
    }, 1e4);
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        const error = new Error("Failed to get canvas context");
        console.error("\u274C [imgToPng]", error);
        reject(error);
        return;
      }
      canvas.width = img.width;
      canvas.height = img.height;
      try {
        ctx.drawImage(img, 0, 0);
        const pngBase64 = canvas.toDataURL("image/png");
        resolve(pngBase64);
      } catch (error) {
        console.error("\u274C [imgToPng] Canvas \u7ED8\u5236\u5931\u8D25:", error);
        reject(error);
      }
    };
    img.onerror = (error) => {
      clearTimeout(timeout);
      if (VERBOSE) {
        console.error("\u274C [imgToPng] \u9519\u8BEF\u4E8B\u4EF6:", error);
        console.error(
          "\u274C [imgToPng] \u5C1D\u8BD5\u52A0\u8F7D\u7684 data URL \u524D 200 \u5B57\u7B26:",
          `data:${mimeType};base64,${base64}`.substring(0, 200)
        );
      }
      reject(new Error(`Failed to load image: ${error.type || "unknown error"}`));
    };
    const dataUrl = `data:${mimeType};base64,${base64}`;
    img.src = dataUrl;
  });
}
function areAllImagesLoaded() {
  const root = arguments.length > 0 ? arguments[0] : document;
  const options = arguments.length > 1 ? arguments[1] : void 0;
  const timeoutMs = options && typeof options.timeoutMs === "number" ? options.timeoutMs : 8e3;
  const qsaRoot = root && typeof root.querySelectorAll === "function" ? root : document;
  return new Promise((resolve) => {
    const images = qsaRoot.querySelectorAll("img");
    if (images.length === 0) {
      resolve();
      return;
    }
    let loadedCount = 0;
    const totalImages = images.length;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const pending = /* @__PURE__ */ new Set();
    const checkAllLoaded = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        resolve();
      }
    };
    images.forEach((img) => {
      pending.add(img);
      const done = () => {
        if (pending.has(img)) pending.delete(img);
        checkAllLoaded();
      };
      if (img.complete) {
        done();
      } else {
        const onLoad = () => {
          cleanup();
          done();
        };
        const onError = () => {
          cleanup();
          done();
        };
        const cleanup = () => {
          img.removeEventListener("load", onLoad);
          img.removeEventListener("error", onError);
          clearTimeout(timerId);
        };
        const timerId = setTimeout(() => {
          cleanup();
          done();
        }, timeoutMs);
        img.addEventListener("load", onLoad, { once: true });
        img.addEventListener("error", onError, { once: true });
      }
    });
    setTimeout(() => {
      if (loadedCount !== totalImages) {
        const elapsed = Math.round(
          (typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt
        );
        console.warn("\u26A0\uFE0F [areAllImagesLoaded] timeout, continue anyway", {
          elapsedMs: elapsed,
          totalImages,
          remaining: pending.size
        });
        resolve();
      }
    }, timeoutMs + 50);
  });
}
var VERBOSE = false;
var FALLBACK_CANVAS_PLACEHOLDER_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVQImWNgYGD4z8DAwMgABYwMjAxQAKkGBgA66gJx4f4x5QAAAABJRU5ErkJggg==";
var createCanvasPlaceholderPng = (width, height, backgroundColor) => {
  try {
    const placeholderCanvas = document.createElement("canvas");
    const safeWidth = Math.max(1, Math.min(32, Math.round(width) || 2));
    const safeHeight = Math.max(1, Math.min(32, Math.round(height) || 2));
    placeholderCanvas.width = safeWidth;
    placeholderCanvas.height = safeHeight;
    const ctx = placeholderCanvas.getContext("2d");
    if (!ctx) {
      return FALLBACK_CANVAS_PLACEHOLDER_PNG;
    }
    ctx.fillStyle = backgroundColor || "#f0f0f0";
    ctx.fillRect(0, 0, safeWidth, safeHeight);
    return placeholderCanvas.toDataURL("image/png");
  } catch {
    return FALLBACK_CANVAS_PLACEHOLDER_PNG;
  }
};
async function convertCanvasToImage(element) {
  const canvases = element.querySelectorAll("canvas");
  canvases.forEach((canvas, index) => {
    try {
      if (canvas.width === 0 || canvas.height === 0) {
        return;
      }
      const computedStyle = window.getComputedStyle(canvas);
      const placeholderDataUrl = createCanvasPlaceholderPng(
        canvas.width,
        canvas.height,
        computedStyle.backgroundColor
      );
      let dataURL;
      try {
        dataURL = canvas.toDataURL("image/png");
      } catch (securityError) {
        if (VERBOSE) {
          console.error(`\u274C [convertCanvasToImage] \u8BE6\u7EC6\u9519\u8BEF:`, securityError);
        }
        const placeholderImg = document.createElement("img");
        placeholderImg.src = placeholderDataUrl;
        placeholderImg.style.width = canvas.style.width || canvas.width + "px";
        placeholderImg.style.height = canvas.style.height || canvas.height + "px";
        placeholderImg.style.backgroundColor = "#f0f0f0";
        placeholderImg.setAttribute("data-canvas-tainted", "true");
        placeholderImg.setAttribute("data-from-canvas", "true");
        placeholderImg.setAttribute("alt", "Canvas (\u8DE8\u57DF\u9650\u5236)");
        placeholderImg.setAttribute("data-canvas-width", String(canvas.width || 0));
        placeholderImg.setAttribute("data-canvas-height", String(canvas.height || 0));
        placeholderImg.style.display = computedStyle.display;
        placeholderImg.style.position = computedStyle.position;
        placeholderImg.style.objectFit = "fill";
        if (canvas.parentNode) {
          canvas.parentNode.replaceChild(placeholderImg, canvas);
        }
        return;
      }
      const img = document.createElement("img");
      img.src = dataURL || placeholderDataUrl;
      img.style.width = canvas.style.width || canvas.width + "px";
      img.style.height = canvas.style.height || canvas.height + "px";
      img.style.display = computedStyle.display;
      img.style.position = computedStyle.position;
      img.style.top = computedStyle.top;
      img.style.left = computedStyle.left;
      img.style.right = computedStyle.right;
      img.style.bottom = computedStyle.bottom;
      img.style.margin = computedStyle.margin;
      img.style.padding = computedStyle.padding;
      if (canvas.className) {
        img.className = canvas.className;
      }
      if (canvas.id) {
        img.id = canvas.id;
      }
      img.setAttribute("data-from-canvas", "true");
      if (canvas.parentNode) {
        canvas.parentNode.replaceChild(img, canvas);
      }
    } catch (error) {
      console.error(`\u274C [convertCanvasToImage] Canvas ${index + 1} \u8F6C\u6362\u5931\u8D25:`, error);
      console.error(`\u274C [convertCanvasToImage] \u9519\u8BEF\u5806\u6808:`, error.stack);
    }
  });
}
async function convertImagesInPage(element) {
  try {
    await convertCanvasToImage(element);
    await convertBackgroundImagesInPage(element);
    await areAllImagesLoaded(element);
    const promises = [];
    const allImages = element.querySelectorAll("img");
    for (let i = 0; i < allImages.length; i++) {
      const img = allImages[i];
      const imageUrl = img.currentSrc || img.src;
      if (!imageUrl) continue;
      if (imageUrl.startsWith("data:image/")) {
        const promise = (async () => {
          try {
            const normalizedDataUrl = await normalizeDataUrlForFigma(imageUrl);
            if (normalizedDataUrl && normalizedDataUrl !== imageUrl) {
              img.setAttribute("src", normalizedDataUrl);
              clearResponsiveImageAttrs(img);
            }
          } catch (error) {
          }
          return true;
        })();
        promises.push(promise);
        continue;
      }
      if (imageUrl && !imageUrl.startsWith("data")) {
        const promise = (async () => {
          try {
            const fullUrl = new URL(imageUrl, document.baseURI).href;
            const canUseChrome = typeof globalThis !== "undefined" && globalThis.chrome?.runtime?.sendMessage;
            const res = canUseChrome ? await Promise.race([
              globalThis.chrome.runtime.sendMessage({
                type: "getResourceContent",
                src: fullUrl
              }),
              new Promise((resolve) => setTimeout(() => resolve(null), 8e3))
            ]) : null;
            if (res?.data?.base64Encoded) {
              if (res.data.mimeType !== "image/png" && res.data.mimeType !== "image/jpeg") {
                try {
                  const base64Data = await imgToPng(res.data.content, res.data.mimeType);
                  img.setAttribute("src", base64Data);
                  clearResponsiveImageAttrs(img);
                } catch (convertError) {
                  try {
                    const fallbackData = `data:${res.data.mimeType};base64,${res.data.content}`;
                    img.setAttribute("src", fallbackData);
                    clearResponsiveImageAttrs(img);
                  } catch {
                  }
                }
              } else {
                const base64Data = `data:${res.data.mimeType};base64,${res.data.content}`;
                img.setAttribute("src", base64Data);
                clearResponsiveImageAttrs(img);
              }
              return true;
            } else {
              try {
                const base64Image = await loadImageAsBase64(fullUrl);
                if (base64Image) {
                  img.setAttribute("src", base64Image);
                  clearResponsiveImageAttrs(img);
                  return true;
                }
              } catch {
              }
              return false;
            }
          } catch (error) {
            if (VERBOSE) {
              console.error("\u274C [convertImagesInPage] \u8BE6\u7EC6\u9519\u8BEF:", error);
            }
            return false;
          }
        })();
        promises.push(promise);
      }
    }
    if (promises.length > 0) {
      try {
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            resolve(new Array(promises.length).fill(false));
          }, 3e4);
        });
        await Promise.race([Promise.allSettled(promises), timeoutPromise]);
      } catch (error) {
        if (VERBOSE) {
          console.error("\u274C [convertImagesInPage] \u8BE6\u7EC6\u9519\u8BEF:", error);
        }
      }
    }
    await areAllImagesLoaded(element, { timeoutMs: 8e3 });
  } catch (error) {
    if (VERBOSE) {
      console.error("\u274C [convertImagesInPage] \u8BE6\u7EC6\u9519\u8BEF:", error);
    }
  }
}

// src/export-core/dom/html-to-figma/helpers/image.js
var objectFitToScaleMode = {
  "fill": "FILL",
  // 拉伸填充
  "contain": "FIT",
  // 保持比例，完整显示
  "cover": "CROP",
  // 保持比例，裁剪填充
  "scale-down": "FIT",
  // 类似 contain
  "none": "TILE"
  // 原始大小，平铺
};
var VERBOSE2 = false;
var TAINTED_CANVAS_FALLBACK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAG0lEQVQImWNgYGD4z8DAwMgABYwMjAxQAKkGBgA66gJx4f4x5QAAAABJRU5ErkJggg==";
function parseBackgroundSizeToScaleMode(backgroundSize) {
  if (!backgroundSize || backgroundSize === "none") {
    return "TILE";
  }
  if (backgroundSize === "contain") {
    return "FIT";
  }
  if (backgroundSize === "cover") {
    return "CROP";
  }
  if (backgroundSize === "auto") {
    return "TILE";
  }
  const values = backgroundSize.split(/\s+/);
  if (values.length >= 1) {
    const [width, height] = values;
    if (width === "100%" && height === "100%") {
      return "FILL";
    }
    if (values.length === 1) {
      if (width === "100%") {
        return "FILL";
      }
      if (width === "auto") {
        return "TILE";
      }
      return "CROP";
    }
    if (values.length >= 2) {
      if (height === "auto" && (width.includes("%") || width.includes("px"))) {
        return "CROP";
      }
      if (width === "auto" && (height.includes("%") || height.includes("px"))) {
        return "CROP";
      }
      if ((width.includes("%") || width.includes("px")) && (height.includes("%") || height.includes("px"))) {
        return "CROP";
      }
      if (width === "auto" && height === "auto") {
        return "TILE";
      }
    }
  }
  return "FILL";
}
function getParentOverflow(element) {
  let parent = element.parentElement;
  while (parent) {
    const computedStyle = getComputedStyle(parent);
    const overflow = computedStyle.overflow;
    if (overflow !== "visible") {
      return overflow;
    }
    parent = parent.parentElement;
  }
  return "visible";
}
function adjustScaleModeForOverflow(scaleMode, parentOverflow) {
  if (parentOverflow === "hidden" || parentOverflow === "scroll" || parentOverflow === "auto") {
    if (scaleMode === "FIT" || scaleMode === "TILE") {
      return "CROP";
    }
  }
  return scaleMode;
}
function getFinalScaleMode(computedStyle, elementType, element) {
  let scaleMode;
  if (elementType === "background") {
    scaleMode = parseBackgroundSizeToScaleMode(computedStyle.backgroundSize);
  } else {
    const objectFit = computedStyle.objectFit || "fill";
    scaleMode = objectFitToScaleMode[objectFit] || "FILL";
  }
  const parentOverflow = getParentOverflow(element);
  return adjustScaleModeForOverflow(scaleMode, parentOverflow);
}
var getImagePaintWithUrl = ({ computedStyle, el }) => {
  if (el instanceof SVGSVGElement) {
    const url = `data:image/svg+xml,${encodeURIComponent(el.outerHTML.replace(/\s+/g, " "))}`;
    const scaleMode = getFinalScaleMode(computedStyle, "image", el);
    if (VERBOSE2) console.log("\u{1F5BC}\uFE0F [getImagePaintWithUrl] SVG \u5143\u7D20:", {
      scaleMode,
      urlLength: url.length
    });
    return {
      url,
      type: "IMAGE",
      scaleMode,
      imageHash: null
    };
  } else {
    if (el instanceof HTMLImageElement) {
      const url = el.src;
      if (url) {
        const scaleMode = getFinalScaleMode(computedStyle, "image", el);
        const isFromCanvas = el.getAttribute("data-from-canvas") === "true";
        const isBase64 = url.startsWith("data:");
        if (VERBOSE2) console.log("\u{1F5BC}\uFE0F [getImagePaintWithUrl] IMG \u5143\u7D20:", {
          scaleMode,
          isFromCanvas,
          isBase64,
          urlLength: url.length,
          urlPrefix: url.substring(0, 50)
        });
        const baseImagePaint = {
          type: "IMAGE",
          scaleMode,
          imageHash: null
        };
        if (isBase64) {
          const intArr = convertDataURIToBinary(url);
          if (intArr.byteLength > 0) {
            baseImagePaint.intArr = Array.from(intArr);
          }
        }
        return Object.assign({ url }, baseImagePaint);
      } else {
        if (el.getAttribute("data-canvas-tainted") === "true") {
          const scaleMode = getFinalScaleMode(computedStyle, "image", el);
          const fallbackPaint = {
            url: TAINTED_CANVAS_FALLBACK_PNG,
            type: "IMAGE",
            scaleMode,
            imageHash: null
          };
          const intArr = convertDataURIToBinary(TAINTED_CANVAS_FALLBACK_PNG);
          if (intArr.byteLength > 0) {
            fallbackPaint.intArr = Array.from(intArr);
          }
          return fallbackPaint;
        }
        console.warn("\u26A0\uFE0F [getImagePaintWithUrl] IMG \u5143\u7D20\u6CA1\u6709 src:", el);
      }
    } else if (el instanceof HTMLVideoElement) {
      const url = el.poster;
      if (url) {
        const scaleMode = getFinalScaleMode(computedStyle, "image", el);
        const baseImagePaint = {
          type: "IMAGE",
          scaleMode,
          imageHash: null
        };
        if (url.startsWith("data:")) {
          const intArr = convertDataURIToBinary(url);
          if (intArr.byteLength > 0) {
            baseImagePaint.intArr = Array.from(intArr);
          }
        }
        return Object.assign({ url }, baseImagePaint);
      }
    }
  }
  if (computedStyle.backgroundImage && computedStyle.backgroundImage !== "none") {
    const urlMatch = computedStyle.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
    const url = urlMatch === null || urlMatch === void 0 ? void 0 : urlMatch[1];
    if (url) {
      if (url.includes(".svg") || url.includes("data:image/svg+xml")) {
        return void 0;
      }
      const scaleMode = getFinalScaleMode(computedStyle, "background", el);
      return {
        url,
        type: "IMAGE",
        scaleMode,
        imageHash: null
      };
    }
  }
  return void 0;
};
var BASE64_MARKER = ";base64,";
function convertDataURIToBinary(dataURI) {
  try {
    const base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    const base64 = dataURI.substring(base64Index);
    if (!base64 || base64.trim() === "") {
      console.warn("\u26A0\uFE0F [convertDataURIToBinary] base64 \u5185\u5BB9\u4E3A\u7A7A");
      return new Uint8Array(0);
    }
    const raw = window.atob(base64);
    const rawLength = raw.length;
    const array = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      array[i] = raw.charCodeAt(i);
    }
    return array;
  } catch (error) {
    console.warn("\u26A0\uFE0F [convertDataURIToBinary] base64 \u89E3\u7801\u5931\u8D25:", error);
    return new Uint8Array(0);
  }
}

// src/export-core/dom/html-to-figma/helpers/fills-generator.js
var VERBOSE3 = false;
function isFillDebugEnabled() {
  try {
    return VERBOSE3 || Boolean(window.__AXHUB_HTML_TO_FIGMA_DEBUG__) || Boolean(window.__AXHUB_FILL_DEBUG__);
  } catch {
    return VERBOSE3;
  }
}
function getElementTrace(el) {
  if (!el || !(el instanceof Element)) {
    return { name: "unknown", className: "" };
  }
  return {
    name: el.tagName.toLowerCase(),
    id: el.id || "",
    className: el.className || ""
  };
}
function parseMultipleBackgroundSizes(backgroundSize) {
  if (!backgroundSize || backgroundSize === "none") {
    return [];
  }
  const sizes = [];
  let current = "";
  let parenCount = 0;
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < backgroundSize.length; i++) {
    const char = backgroundSize[i];
    const prevChar = i > 0 ? backgroundSize[i - 1] : "";
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }
    if (!inString) {
      if (char === "(") {
        parenCount++;
      } else if (char === ")") {
        parenCount--;
      }
    }
    if (char === "," && !inString && parenCount === 0) {
      const trimmed = current.trim();
      if (trimmed) {
        sizes.push(trimmed);
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    sizes.push(current.trim());
  }
  return sizes;
}
function parseMultipleBlendModes(blendModeStr) {
  if (!blendModeStr) return [];
  return blendModeStr.split(",").map((m) => m.trim()).filter(Boolean);
}
function mapBlendMode(mode) {
  const m = (mode || "").toLowerCase();
  switch (m) {
    case "normal":
    case "src-over":
      return "NORMAL";
    case "multiply":
      return "MULTIPLY";
    case "screen":
      return "SCREEN";
    case "overlay":
      return "OVERLAY";
    case "darken":
      return "DARKEN";
    case "lighten":
      return "LIGHTEN";
    case "color-dodge":
      return "COLOR_DODGE";
    case "color-burn":
      return "COLOR_BURN";
    case "hard-light":
      return "HARD_LIGHT";
    case "soft-light":
      return "SOFT_LIGHT";
    case "difference":
      return "DIFFERENCE";
    case "exclusion":
      return "EXCLUSION";
    case "hue":
      return "HUE";
    case "saturation":
      return "SATURATION";
    case "color":
      return "COLOR";
    case "luminosity":
      return "LUMINOSITY";
    default:
      return "NORMAL";
  }
}
function parseBackgroundSizeToScaleMode2(backgroundSize) {
  if (!backgroundSize || backgroundSize === "none" || backgroundSize === "auto") {
    return "TILE";
  }
  if (backgroundSize === "contain") {
    return "FIT";
  }
  if (backgroundSize === "cover") {
    return "CROP";
  }
  const values = backgroundSize.split(/\s+/);
  if (values.length >= 1) {
    const [width, height] = values;
    if (width === "100%" && height === "100%") {
      return "FILL";
    }
    if (values.length === 1) {
      if (width === "100%") {
        return "FILL";
      }
      if (width === "auto") {
        return "TILE";
      }
      return "CROP";
    }
    if (values.length >= 2) {
      if (height === "auto" && (width.includes("%") || width.includes("px"))) {
        return "CROP";
      }
      if (width === "auto" && (height.includes("%") || height.includes("px"))) {
        return "CROP";
      }
      if ((width.includes("%") || width.includes("px")) && (height.includes("%") || height.includes("px"))) {
        return "CROP";
      }
      if (width === "auto" && height === "auto") {
        return "TILE";
      }
    }
  }
  return "FILL";
}
function calculateFinalOpacity(inlineStyle, colorAlpha = 1) {
  let finalOpacity = 1;
  if (inlineStyle.opacity && inlineStyle.opacity !== "") {
    const elementOpacity = parseFloat(inlineStyle.opacity);
    if (!isNaN(elementOpacity)) {
      finalOpacity = elementOpacity;
    }
  }
  if (colorAlpha !== void 0 && colorAlpha !== 1) {
    finalOpacity = finalOpacity * colorAlpha;
  }
  return finalOpacity;
}
function parseMultipleBackgrounds(backgroundImage) {
  if (!backgroundImage || backgroundImage === "none") {
    return [];
  }
  const layers = [];
  let current = "";
  let parenCount = 0;
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < backgroundImage.length; i++) {
    const char = backgroundImage[i];
    const prevChar = i > 0 ? backgroundImage[i - 1] : "";
    if ((char === '"' || char === "'") && prevChar !== "\\") {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = "";
      }
    }
    if (!inString) {
      if (char === "(") {
        parenCount++;
      } else if (char === ")") {
        parenCount--;
      }
    }
    if (char === "," && !inString && parenCount === 0) {
      const trimmed = current.trim();
      if (trimmed) {
        layers.push(parseBackgroundLayer(trimmed));
      }
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    layers.push(parseBackgroundLayer(current.trim()));
  }
  return layers;
}
function parseBackgroundLayer(layer) {
  if (layer.includes("linear-gradient") || layer.includes("radial-gradient") || layer.includes("conic-gradient") || layer.includes("repeating-linear-gradient") || layer.includes("repeating-radial-gradient")) {
    return { type: "gradient", value: layer };
  }
  if (layer.includes("url(")) {
    const urlMatch = layer.match(/url\(['"]?(.*?)['"]?\)/);
    if (urlMatch && urlMatch[1]) {
      const url = urlMatch[1];
      if (url.includes(".svg") || url.includes("data:image/svg+xml")) {
        return { type: "svg", value: url };
      }
      return { type: "image", value: url };
    }
  }
  if (layer.includes("data:image/") && !layer.includes("data:image/svg+xml")) {
    return { type: "image", value: layer.trim() };
  }
  return { type: "unknown", value: layer };
}
async function generateFillsFromStyles(inlineStyle, el = null, options = {}) {
  const debugEnabled = isFillDebugEnabled();
  const trace = getElementTrace(el);
  const {
    includeImageFills = true,
    includeBackgroundColor = true,
    includeComplexBackgrounds = true
  } = options;
  const fills = [];
  if (includeComplexBackgrounds && needsScreenshotBackground(inlineStyle)) {
    if (debugEnabled) {
      console.log("[fills] complex-background-screenshot", {
        trace,
        backgroundImage: inlineStyle.backgroundImage,
        background: inlineStyle.background
      });
    }
    if (includeBackgroundColor) {
      addBackgroundColorFill(fills, inlineStyle);
    }
    if (el) {
      try {
        const imagePaint = await convertElementToBase64Image(el, inlineStyle, {
          ignoreBackgroundColor: true
        });
        if (imagePaint) {
          fills.push(imagePaint);
          if (debugEnabled) {
            console.log("[fills] screenshot-image-added", {
              trace,
              fillTypes: fills.map((item) => item.type)
            });
          }
          return fills;
        }
      } catch (error) {
        console.error(`\u274C [generateFillsFromStyles] \u590D\u6742\u80CC\u666F\u8F6C\u6362\u51FA\u9519:`, error);
      }
    }
    if (fills.length === 0) {
      addBackgroundColorFill(fills, inlineStyle);
    }
    return fills;
  }
  if (includeImageFills && el) {
    const imagePaint = getImagePaintWithUrl({ computedStyle: inlineStyle, el });
    if (imagePaint) {
      fills.push(imagePaint);
      return fills;
    }
  }
  if (includeImageFills || includeComplexBackgrounds) {
    const backgroundImage = inlineStyle.backgroundImage;
    const blendModes = parseMultipleBlendModes(inlineStyle.backgroundBlendMode || "");
    if (backgroundImage && backgroundImage !== "none") {
      let width = 1;
      let height = 1;
      if (el) {
        const rect = el.getBoundingClientRect();
        const actualWidth = rect.width || 1;
        const actualHeight = rect.height || 1;
        if (actualWidth >= actualHeight) {
          width = 1;
          height = actualHeight / actualWidth;
        } else {
          width = actualWidth / actualHeight;
          height = 1;
        }
      }
      const layers = parseMultipleBackgrounds(backgroundImage);
      if (layers.length > 0) {
        if (debugEnabled) {
          console.log("[fills] parsed-background-layers", {
            trace,
            backgroundImage,
            layerTypes: layers.map((item) => item.type)
          });
        }
        const backgroundSizes = parseMultipleBackgroundSizes(inlineStyle.backgroundSize || "auto");
        if (includeBackgroundColor) {
          addBackgroundColorFill(fills, inlineStyle);
        }
        const layerFills = [];
        for (let i = layers.length - 1; i >= 0; i--) {
          const layer = layers[i];
          let layerFill = null;
          const blendMode = blendModes.length > 0 ? mapBlendMode(blendModes[Math.min(i, blendModes.length - 1)]) : "NORMAL";
          if (layer.type === "gradient") {
            const gradientFill = cssToFigmaGradient(layer.value, width, height);
            if (gradientFill) {
              layerFill = { ...gradientFill, blendMode };
            }
          } else if (layer.type === "image") {
            const sizeForLayer = backgroundSizes[i] || backgroundSizes[backgroundSizes.length - 1] || "auto";
            const scaleMode = parseBackgroundSizeToScaleMode2(sizeForLayer);
            layerFill = await generateImageFill(layer.value, scaleMode, null);
            if (layerFill) {
              layerFill = { ...layerFill, blendMode };
            }
          } else if (layer.type === "svg") {
            const sizeForLayer = backgroundSizes[i] || backgroundSizes[backgroundSizes.length - 1] || "auto";
            const scaleMode = parseBackgroundSizeToScaleMode2(sizeForLayer);
            layerFill = await generateImageFill(layer.value, scaleMode, null);
            if (layerFill) {
              layerFill = { ...layerFill, blendMode };
            }
          }
          if (layerFill) {
            layerFills.push(layerFill);
          }
        }
        fills.push(...layerFills);
        if (debugEnabled) {
          const hasImageFill = fills.some((item) => item.type === "IMAGE");
          const hasGradientFill = fills.some(
            (item) => item.type === "GRADIENT_LINEAR" || item.type === "GRADIENT_RADIAL"
          );
          console.log("[fills] final-fills", {
            trace,
            fillTypes: fills.map((item) => item.type),
            hasImageFill,
            hasGradientFill
          });
        }
        return fills;
      }
    }
  }
  if (includeBackgroundColor && !hasComplexBackground(inlineStyle) && !isImageBackground(inlineStyle)) {
    addBackgroundColorFill(fills, inlineStyle);
  }
  return fills;
}
function addBackgroundColorFill(fills, inlineStyle) {
  const color = getRgb(inlineStyle.backgroundColor);
  if (color && color.a > 0) {
    const finalOpacity = calculateFinalOpacity(inlineStyle, color.a);
    const solidPaint = {
      type: "SOLID",
      color: {
        r: color.r,
        g: color.g,
        b: color.b
      },
      opacity: finalOpacity
    };
    fills.push(solidPaint);
  }
}
function needsScreenshotBackground(computedStyle) {
  const backgroundImage = computedStyle.backgroundImage;
  const background = computedStyle.background;
  if (backgroundImage && backgroundImage !== "none") {
    if (backgroundImage.includes("conic-gradient")) {
      return true;
    }
  }
  if (background && background !== "none") {
    if (background.includes("conic-gradient")) {
      return true;
    }
  }
  if (hasRepeatingGradient(computedStyle)) {
    return true;
  }
  const maskImage = computedStyle.maskImage || computedStyle.webkitMaskImage;
  if (maskImage && maskImage !== "none") {
    return true;
  }
  if (hasComplexBorder(computedStyle)) {
    return true;
  }
  if (hasClipPath(computedStyle)) {
    return true;
  }
  if (hasUnsupportedBackgroundImageProperties(computedStyle)) {
    return true;
  }
  return false;
}
function hasComplexBorder(computedStyle) {
  const borders = {
    top: computedStyle.borderTop,
    right: computedStyle.borderRight,
    bottom: computedStyle.borderBottom,
    left: computedStyle.borderLeft
  };
  const hasAnyBorder = Object.values(borders).some((border) => border && border !== "none");
  if (!hasAnyBorder) {
    return false;
  }
  const borderInfos = {};
  for (const [dir, border] of Object.entries(borders)) {
    if (border && border !== "none") {
      const parsed = border.match(/^([\d\.]+)px\s*(\w+)\s*(.*)$/);
      if (parsed) {
        const [_match, borderWidth, borderType, borderColor] = parsed;
        borderInfos[dir] = { borderWidth, borderType, borderColor };
      }
    } else {
      borderInfos[dir] = { borderWidth: "0", borderType: "none", borderColor: "transparent" };
    }
  }
  const firstBorder = Object.values(borderInfos).find((info) => info.borderWidth !== "0");
  if (!firstBorder) {
    return false;
  }
  const consistent = Object.values(borderInfos).every(
    (info) => info.borderWidth === firstBorder.borderWidth && info.borderType === firstBorder.borderType && info.borderColor === firstBorder.borderColor
  );
  return !consistent;
}
function hasClipPath(computedStyle) {
  const clipPath = computedStyle.clipPath;
  const webkitClipPath = computedStyle.webkitClipPath;
  return clipPath && clipPath !== "none" || webkitClipPath && webkitClipPath !== "none";
}
function hasUnsupportedBackgroundImageProperties(computedStyle) {
  const backgroundImage = computedStyle.backgroundImage;
  if (!backgroundImage || backgroundImage === "none") {
    return false;
  }
  const backgroundAttachment = computedStyle.backgroundAttachment;
  if (backgroundAttachment && backgroundAttachment === "fixed") {
    return true;
  }
  const backgroundOrigin = computedStyle.backgroundOrigin;
  if (backgroundOrigin && backgroundOrigin !== "padding-box") {
    return true;
  }
  const backgroundRepeat = computedStyle.backgroundRepeat;
  if (backgroundRepeat && (backgroundRepeat === "repeat-x" || backgroundRepeat === "repeat-y")) {
    return true;
  }
  const backgroundPositionX = computedStyle.backgroundPositionX;
  const backgroundPositionY = computedStyle.backgroundPositionY;
  const hasNonDefaultPositionX = backgroundPositionX && backgroundPositionX !== "0%" && backgroundPositionX !== "left" && backgroundPositionX !== "50%" && backgroundPositionX !== "center";
  const hasNonDefaultPositionY = backgroundPositionY && backgroundPositionY !== "0%" && backgroundPositionY !== "top" && backgroundPositionY !== "50%" && backgroundPositionY !== "center";
  if (hasNonDefaultPositionX || hasNonDefaultPositionY) {
    return true;
  }
  const backgroundSize = computedStyle.backgroundSize;
  if (backgroundSize && backgroundSize !== "auto") {
    if (backgroundSize !== "cover" && backgroundSize !== "contain") {
      if (backgroundSize !== "100% 100%" && backgroundSize !== "100%") {
        if (backgroundSize.includes("px") || backgroundSize.includes("%") && !backgroundSize.startsWith("100%")) {
          return true;
        }
      }
    }
  }
  return false;
}
function hasComplexBackground(computedStyle) {
  const backgroundImage = computedStyle.backgroundImage;
  const background = computedStyle.background;
  if (backgroundImage && backgroundImage !== "none") {
    if (backgroundImage.includes("linear-gradient") || backgroundImage.includes("radial-gradient") || backgroundImage.includes("conic-gradient") || backgroundImage.includes("repeating-linear-gradient") || backgroundImage.includes("repeating-radial-gradient")) {
      return true;
    }
  }
  if (background && background !== "none") {
    if (background.includes("linear-gradient") || background.includes("radial-gradient") || background.includes("conic-gradient") || background.includes("repeating-linear-gradient") || background.includes("repeating-radial-gradient")) {
      return true;
    }
  }
  return false;
}
function hasRepeatingGradient(computedStyle) {
  const backgroundImage = computedStyle.backgroundImage;
  const background = computedStyle.background;
  if (backgroundImage && backgroundImage !== "none") {
    if (backgroundImage.includes("repeating-linear-gradient") || backgroundImage.includes("repeating-radial-gradient")) {
      return true;
    }
  }
  if (background && background !== "none") {
    if (background.includes("repeating-linear-gradient") || background.includes("repeating-radial-gradient")) {
      return true;
    }
  }
  return false;
}
function isImageBackground(computedStyle) {
  const backgroundImage = computedStyle.backgroundImage;
  const background = computedStyle.background;
  if (backgroundImage && backgroundImage !== "none") {
    if (backgroundImage.includes("url(") || backgroundImage.includes("data:")) {
      const urlMatch = backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];
        if (url.includes(".svg") || url.includes("data:image/svg+xml")) {
          return false;
        }
        return true;
      }
    }
  }
  if (background && background !== "none") {
    if (background.includes("url(") || background.includes("data:")) {
      const urlMatch = background.match(/url\(['"]?(.*?)['"]?\)/);
      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];
        if (url.includes(".svg") || url.includes("data:image/svg+xml")) {
          return false;
        }
        return true;
      }
    }
  }
  return false;
}
async function convertElementToBase64Image(el, computedStyle, options = {}) {
  try {
    const rect = el.getBoundingClientRect();
    const maxSize = 4096;
    if (rect.width > maxSize || rect.height > maxSize) {
      return null;
    }
    const { snapdom } = await import("@zumer/snapdom");
    const tempEl = el.cloneNode(true);
    tempEl.removeAttribute("id");
    for (let i = 0; i < computedStyle.length; i++) {
      const prop = computedStyle[i];
      const value = computedStyle.getPropertyValue(prop);
      if (value) {
        tempEl.style.setProperty(prop, value);
      }
    }
    if (options.ignoreBackgroundColor) {
      tempEl.style.backgroundColor = "transparent";
    }
    tempEl.style.width = `${rect.width}px`;
    tempEl.style.height = `${rect.height}px`;
    tempEl.style.boxSizing = "border-box";
    tempEl.style.margin = "0";
    tempEl.style.position = "fixed";
    tempEl.style.top = "0";
    tempEl.style.left = "0";
    tempEl.style.zIndex = "99999";
    tempEl.style.pointerEvents = "none";
    tempEl.style.visibility = "visible";
    tempEl.style.opacity = "1";
    tempEl.style.color = "transparent";
    tempEl.style.webkitTextFillColor = "transparent";
    tempEl.style.textShadow = "none";
    Array.from(tempEl.children).forEach((child) => {
      child.style.visibility = "hidden";
    });
    document.body.appendChild(tempEl);
    const pngImage = await snapdom.toPng(tempEl, {
      //compress: true,
      fast: false,
      embedFonts: true,
      scale: 1,
      dpr: 1,
      width: rect.width,
      // 使用精确宽度
      height: rect.height
      // 使用精确高度
    });
    document.body.removeChild(tempEl);
    if (!pngImage || !pngImage.src) {
      console.error(`\u274C [convertElementToBase64Image] snapdom \u8FD4\u56DE\u65E0\u6548\u7684\u56FE\u7247\u5143\u7D20`);
      return null;
    }
    return {
      type: "IMAGE",
      url: pngImage.src,
      // HTMLImageElement.src 就是 base64 或 URL
      scaleMode: "FILL",
      imageHash: null
    };
  } catch (error) {
    console.error(`\u274C [convertElementToBase64Image] \u8F6C\u6362\u5931\u8D25:`, error);
    return null;
  }
}
function cssToFigmaGradient(gradientString, width = 1, height = 1) {
  if (!gradientString) return null;
  const cleanGradient = gradientString.replace(/\s+/g, " ").trim();
  const linearMatch = cleanGradient.match(/linear-gradient\s*\((.+)\)/i);
  if (linearMatch) return parseLinearGradient(linearMatch[1], width, height);
  const radialMatch = cleanGradient.match(/radial-gradient\s*\((.+)\)/i);
  if (radialMatch) return parseRadialGradient(radialMatch[1]);
  const conicMatch = cleanGradient.match(/conic-gradient\s*\((.+)\)/i);
  if (conicMatch) return null;
  return null;
}
function parseLinearGradient(params, width = 1, height = 1) {
  const parts = smartSplitGradientParams(params);
  let direction = "to bottom";
  let colorStops = [];
  if (isDirectionKeyword(parts[0])) {
    direction = parts[0];
    colorStops = parts.slice(1);
  } else {
    colorStops = parts;
  }
  const stops = parseColorStops(colorStops);
  if (!stops.length) return null;
  const gradientTransform = calculateLinearGradientTransform(direction, width, height);
  return {
    type: "GRADIENT_LINEAR",
    gradientTransform,
    gradientStops: stops,
    opacity: 1,
    visible: true,
    blendMode: "NORMAL"
  };
}
function parseRadialGradient(params) {
  const parts = smartSplitGradientParams(params);
  let shape = "ellipse";
  let position = "center";
  let colorStops = [];
  if (isRadialShapeKeyword(parts[0]) || isPositionKeyword(parts[0])) {
    shape = parts[0];
    colorStops = parts.slice(1);
  } else {
    colorStops = parts;
  }
  const stops = parseColorStops(colorStops);
  if (!stops.length) return null;
  const gradientTransform = calculateRadialGradientTransform(shape, position);
  return {
    type: "GRADIENT_RADIAL",
    gradientTransform,
    gradientStops: stops,
    opacity: 1,
    visible: true,
    blendMode: "NORMAL"
  };
}
function smartSplitGradientParams(paramString) {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < paramString.length; i++) {
    const char = paramString[i];
    if (char === "(") {
      depth++;
    } else if (char === ")") {
      depth--;
    } else if (char === "," && depth === 0) {
      result.push(paramString.slice(start, i).trim());
      start = i + 1;
    }
  }
  result.push(paramString.slice(start).trim());
  return result;
}
function isDirectionKeyword(str) {
  if (/to (top|bottom|left|right)/i.test(str)) {
    return true;
  }
  if (/\d+deg/i.test(str)) {
    return true;
  }
  return false;
}
function isRadialShapeKeyword(str) {
  return /(circle|ellipse)/i.test(str);
}
function isPositionKeyword(str) {
  return /(center|top|bottom|left|right)/i.test(str);
}
function parseColorStops(colorStops) {
  const stops = colorStops.map((stop, index) => {
    const trimmed = stop.trim();
    const positionMatch = trimmed.match(/\s+(\d*\.?\d+%?)\s*$/);
    let colorStr = trimmed;
    let position = void 0;
    if (positionMatch) {
      const positionStr = positionMatch[1];
      const positionValue = parseFloat(positionStr);
      if (!isNaN(positionValue)) {
        position = positionStr.includes("%") ? positionValue / 100 : positionValue;
      }
      colorStr = trimmed.substring(0, positionMatch.index).trim();
    }
    const color = parseCssColor(colorStr);
    return {
      position,
      color
    };
  });
  const stopsWithPosition = stops.filter((s) => s.position !== void 0);
  const stopsWithoutPosition = stops.filter((s) => s.position === void 0);
  if (stopsWithoutPosition.length > 0) {
    if (stopsWithPosition.length === 0) {
      stops.forEach((stop, index) => {
        stop.position = stops.length > 1 ? index / (stops.length - 1) : 0;
      });
    } else {
      stopsWithoutPosition.forEach((stop, index) => {
        const totalStops = stops.length;
        stop.position = (stopsWithPosition.length + index) / (totalStops - 1);
      });
    }
  }
  stops.sort((a, b) => (a.position || 0) - (b.position || 0));
  stops.forEach((stop) => {
    stop.position = Math.max(0, Math.min(1, stop.position || 0));
  });
  if (stops.length === 1) {
    const singleStop = stops[0];
    stops.push({
      position: 1,
      color: { ...singleStop.color }
    });
    stops[0].position = 0;
  }
  return stops.map((stop) => ({
    position: stop.position,
    color: stop.color
  }));
}
function parseCssColor(cssColor) {
  const rgb = getRgb(cssColor);
  if (rgb) {
    return rgb;
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}
function calculateLinearGradientTransform(direction, width = 1, height = 1) {
  const dirMap = {
    "to top": 0,
    "to top right": 45,
    "to right top": 45,
    "to right": 90,
    "to bottom right": 135,
    "to right bottom": 135,
    "to bottom": 180,
    "to bottom left": 225,
    "to left bottom": 225,
    "to left": 270,
    "to top left": 315,
    "to left top": 315
  };
  let angleDeg;
  const dir = direction.trim().toLowerCase();
  if (dir.endsWith("deg")) {
    angleDeg = parseFloat(dir);
  } else if (dirMap[dir] !== void 0) {
    angleDeg = dirMap[dir];
  } else {
    angleDeg = 180;
  }
  const rad = angleDeg * Math.PI / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  return [
    [dx, -dy, 0.5],
    [dy, dx, 0.5]
  ];
}
function calculateRadialGradientTransform(shape, position) {
  return [
    [0.5, 0, 0.5],
    [0, 0.5, 0.5]
  ];
}
function isSvgUrl(url) {
  if (!url) return false;
  if (url.includes(".svg") && !url.includes(".svg?")) {
    const urlWithoutQuery = url.split("?")[0];
    if (urlWithoutQuery.endsWith(".svg")) {
      return true;
    }
  }
  if (url.startsWith("data:image/svg+xml")) {
    return true;
  }
  return false;
}
async function convertSvgToPng(svgUrl) {
  try {
    let svgContent = "";
    let mimeType = "image/svg+xml";
    if (svgUrl.startsWith("data:image/svg+xml")) {
      if (svgUrl.includes(";base64,")) {
        const base64Match = svgUrl.match(/data:image\/svg\+xml;base64,(.+)/);
        if (base64Match && base64Match[1]) {
          try {
            svgContent = atob(base64Match[1]);
          } catch (error) {
            return null;
          }
        }
      } else {
        const urlMatch = svgUrl.match(/data:image\/svg\+xml,(.+)/);
        if (urlMatch && urlMatch[1]) {
          svgContent = decodeURIComponent(urlMatch[1]);
        }
      }
    } else {
      try {
        const fullUrl = new URL(svgUrl, document.baseURI).href;
        const canUseChrome = typeof chrome !== "undefined" && chrome?.runtime?.sendMessage;
        const res = canUseChrome ? await chrome.runtime.sendMessage({
          type: "getResourceContent",
          src: fullUrl
        }) : null;
        if (res?.data?.content) {
          svgContent = res.data.content;
          if (res.data.base64Encoded) {
            try {
              svgContent = atob(svgContent);
            } catch (error) {
              return null;
            }
          }
          mimeType = res.data.mimeType || "image/svg+xml";
        } else {
          const response = await fetch(fullUrl, {
            method: "GET",
            mode: "cors"
          });
          if (!response.ok) {
            throw new Error(`Failed to load SVG: ${response.statusText}`);
          }
          svgContent = await response.text();
        }
      } catch (error) {
        const fullUrl = new URL(svgUrl, document.baseURI).href;
        const response = await fetch(fullUrl, {
          method: "GET",
          mode: "cors"
        });
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
        }
        svgContent = await response.text();
      }
    }
    if (!svgContent) {
      throw new Error("\u65E0\u6CD5\u83B7\u53D6 SVG \u5185\u5BB9");
    }
    svgContent = svgContent.replace(/\\"/g, '"').replace(/\\\\/g, "");
    const base64Svg = btoa(unescape(encodeURIComponent(svgContent)));
    const pngDataUrl = await imgToPng(base64Svg, mimeType);
    return pngDataUrl;
  } catch (error) {
    console.error("\u274C [convertSvgToPng] SVG \u8F6C PNG \u5931\u8D25:", error);
    return svgUrl;
  }
}
async function generateImageFill(url, scaleMode = "FILL", imageHash = null) {
  let finalUrl = url;
  const lowerUrl = (url || "").toLowerCase();
  if (url?.startsWith("data:image/webp")) {
    const base64 = url.split(";base64,")[1];
    if (base64) {
      try {
        finalUrl = await imgToPng(base64, "image/webp");
      } catch (err) {
        void err;
      }
    }
  } else if (/\.(webp)(\?|#|$)/i.test(lowerUrl)) {
    try {
      const pngDataUrl = await loadImageAsBase64(url);
      if (pngDataUrl) {
        finalUrl = pngDataUrl;
      }
    } catch (err) {
      void err;
    }
  }
  if (isSvgUrl(finalUrl)) {
    const pngUrl = await convertSvgToPng(finalUrl);
    return {
      type: "IMAGE",
      url: pngUrl,
      scaleMode,
      imageHash
    };
  }
  if (typeof finalUrl === "string" && finalUrl && !finalUrl.startsWith("data:")) {
    try {
      const base64DataUrl = await loadImageAsBase64(finalUrl);
      if (base64DataUrl) {
        finalUrl = base64DataUrl;
      }
    } catch {
    }
  }
  return {
    type: "IMAGE",
    url: finalUrl,
    scaleMode,
    imageHash
  };
}

export {
  parseUnits,
  parseBorderRadius,
  getRgb,
  parseBoxShadowStr,
  parseTextShadowStr,
  parseFilterStr,
  parseBackdropFilterStr,
  convertImagesInPage,
  generateFillsFromStyles,
  needsScreenshotBackground
};
