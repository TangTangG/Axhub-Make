import {
  convertImagesInPage,
  getRgb,
  needsScreenshotBackground
} from "./chunk-C4HSV5O2.mjs";

// src/export-core/dom/html-to-figma/html-to-axure.js
var EXPORT_OVERLAY_ROOT_ID = "export-overlay-root";
var HIDDEN_TAGS = /* @__PURE__ */ new Set(["script", "style", "noscript", "meta", "link", "title"]);
var MEDIA_TAGS = /* @__PURE__ */ new Set(["img", "canvas", "video"]);
var SVG_GEOMETRY_TAGS = /* @__PURE__ */ new Set(["path", "line", "polyline", "polygon", "rect", "circle", "ellipse"]);
var DEFAULT_TEXT_ALIGN = 0;
var SOLID_FILL_TYPE = 1;
var IMAGE_FILL_TYPE = 3;
var ITEM_TYPE_GROUP = 0;
var ITEM_TYPE_LAYER = 1;
var ITEM_TYPE_ARTBOARD = 2;
var OVERFLOW_CLIPPING_VALUES = /* @__PURE__ */ new Set(["hidden", "clip", "auto", "scroll"]);
var round = (value) => Math.round(value * 1e3) / 1e3;
var toNumber = (value, fallback = 0) => {
  const num = Number.parseFloat(String(value || ""));
  return Number.isFinite(num) ? num : fallback;
};
var getPageSize = () => {
  const doc = document.documentElement;
  const body = document.body;
  const width = Math.max(
    doc?.scrollWidth || 0,
    doc?.clientWidth || 0,
    body?.scrollWidth || 0,
    body?.clientWidth || 0
  );
  const height = Math.max(
    doc?.scrollHeight || 0,
    doc?.clientHeight || 0,
    body?.scrollHeight || 0,
    body?.clientHeight || 0
  );
  return {
    width: Math.max(1, round(width)),
    height: Math.max(1, round(height))
  };
};
var isTransparentColor = (color) => {
  if (!color) return true;
  const normalized = color.trim().toLowerCase();
  if (normalized === "transparent") return true;
  if (normalized === "rgba(0, 0, 0, 0)" || normalized === "rgba(0,0,0,0)") return true;
  return false;
};
var parseCssColor = (cssColor) => {
  if (!cssColor) return null;
  const value = cssColor.trim();
  const parsed = getRgb(value);
  if (parsed) {
    return {
      r: Math.min(1, Math.max(0, Number(parsed.r) || 0)),
      g: Math.min(1, Math.max(0, Number(parsed.g) || 0)),
      b: Math.min(1, Math.max(0, Number(parsed.b) || 0)),
      a: Math.min(1, Math.max(0, Number(parsed.a) || 0))
    };
  }
  return null;
};
var splitCssCommaList = (value) => {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "(") depth += 1;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      result.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail) result.push(tail);
  return result;
};
var parseShadowColor = (raw) => {
  if (!raw) return null;
  const colorToken = raw.match(/rgba?\([^)]*\)/i)?.[0] || raw.match(/hsla?\([^)]*\)/i)?.[0] || raw.match(/#[0-9a-f]{3,8}/i)?.[0] || (/transparent/i.test(raw) ? "transparent" : null);
  if (!colorToken) return null;
  return parseCssColor(colorToken);
};
var parseShadowList = (shadowValue) => {
  if (!shadowValue || shadowValue === "none") return [];
  const shadows = splitCssCommaList(shadowValue);
  return shadows.map((shadow) => {
    const isInset = /\binset\b/i.test(shadow);
    const color = parseShadowColor(shadow) || { r: 0, g: 0, b: 0, a: 1 };
    const lengthMatches = shadow.match(/-?\d*\.?\d+px/gi) || [];
    const offsetX = toNumber(lengthMatches[0], 0);
    const offsetY = toNumber(lengthMatches[1], 0);
    const blur = Math.max(0, toNumber(lengthMatches[2], 0));
    const spread = Math.max(0, toNumber(lengthMatches[3], 0));
    return {
      color,
      enabled: true,
      blur: round(blur),
      offset: {
        x: round(offsetX),
        y: round(offsetY)
      },
      type: 1,
      shadowType: isInset ? 1 : 0,
      spread: round(spread)
    };
  }).filter((item) => item.color);
};
var getSolidFill = (cssColor, enabled = true) => {
  const parsed = parseCssColor(cssColor);
  if (!parsed) return null;
  return {
    type: SOLID_FILL_TYPE,
    enabled,
    color: parsed
  };
};
var createStroke = (fill, alignment = 0) => {
  if (!fill) return null;
  return {
    alignment,
    fill
  };
};
var getResizingConstraints = () => ({
  hasFixedLeft: true,
  hasFixedRight: false,
  hasFixedTop: true,
  hasFixedBottom: false,
  hasFixedWidth: true,
  hasFixedHeight: true
});
var getFreeResizingConstraints = () => ({
  hasFixedLeft: false,
  hasFixedRight: false,
  hasFixedTop: false,
  hasFixedBottom: false,
  hasFixedWidth: false,
  hasFixedHeight: false
});
var mapTextAlign = (textAlign) => {
  switch ((textAlign || "").toLowerCase()) {
    case "center":
      return 1;
    case "right":
      return 2;
    case "justify":
      return 3;
    case "left":
    default:
      return 0;
  }
};
var mapAxisAlignKeyword = (value, isMainAxis = false) => {
  const normalized = String(value || "").toLowerCase().trim();
  switch (normalized) {
    case "center":
      return "center";
    case "end":
    case "flex-end":
    case "right":
    case "self-end":
      return "end";
    case "space-around":
    case "space-evenly":
      return "center";
    case "space-between":
      return isMainAxis ? "start" : "center";
    case "baseline":
    case "stretch":
    case "normal":
    case "start":
    case "left":
    case "flex-start":
    default:
      return "start";
  }
};
var mapAxisAlignToTextAlign = (axisAlign, fallback = 0) => {
  if (axisAlign === "center") return 1;
  if (axisAlign === "end") return 2;
  if (axisAlign === "start") return 0;
  return fallback;
};
var mapAxisAlignToVerticalAlign = (axisAlign) => {
  if (axisAlign === "center") return "middle";
  if (axisAlign === "end") return "bottom";
  return "top";
};
var resolveFlexTextAlignment = (computedStyle) => {
  const display = String(computedStyle.display || "").toLowerCase().trim();
  if (!display.includes("flex")) return null;
  const flexDirection = (computedStyle.flexDirection || "row").toLowerCase();
  const isColumn = flexDirection.startsWith("column");
  const mainAxisAlign = mapAxisAlignKeyword(computedStyle.justifyContent, true);
  const crossAxisAlign = mapAxisAlignKeyword(computedStyle.alignItems, false);
  const horizontalAxisAlign = isColumn ? crossAxisAlign : mainAxisAlign;
  const verticalAxisAlign = isColumn ? mainAxisAlign : crossAxisAlign;
  return {
    horizontalTextAlign: mapAxisAlignToTextAlign(horizontalAxisAlign, 0),
    verticalAlign: mapAxisAlignToVerticalAlign(verticalAxisAlign)
  };
};
var getBoxOffsets = (computedStyle) => {
  const borderTop = Math.max(0, toNumber(computedStyle.borderTopWidth, 0));
  const borderRight = Math.max(0, toNumber(computedStyle.borderRightWidth, 0));
  const borderBottom = Math.max(0, toNumber(computedStyle.borderBottomWidth, 0));
  const borderLeft = Math.max(0, toNumber(computedStyle.borderLeftWidth, 0));
  const paddingTop = Math.max(0, toNumber(computedStyle.paddingTop, 0));
  const paddingRight = Math.max(0, toNumber(computedStyle.paddingRight, 0));
  const paddingBottom = Math.max(0, toNumber(computedStyle.paddingBottom, 0));
  const paddingLeft = Math.max(0, toNumber(computedStyle.paddingLeft, 0));
  return {
    borderTop,
    borderRight,
    borderBottom,
    borderLeft,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft
  };
};
var resolveVerticalTextAlign = (computedStyle) => {
  const verticalAlign = (computedStyle.verticalAlign || "").toLowerCase();
  if (verticalAlign === "middle") return "middle";
  if (verticalAlign === "bottom" || verticalAlign === "text-bottom") return "bottom";
  return "top";
};
var getMeasuredTextHeight = /* @__PURE__ */ (() => {
  let ctx = null;
  return (text, computedStyle, fontSize, fallbackHeight) => {
    if (!text) return Math.max(1, round(fallbackHeight));
    try {
      if (!ctx) {
        const canvas = document.createElement("canvas");
        ctx = canvas.getContext("2d");
      }
      if (!ctx) return Math.max(1, round(fallbackHeight));
      const fontStyle = computedStyle.fontStyle || "normal";
      const fontWeight = computedStyle.fontWeight || "400";
      const fontFamily = normalizePrimaryFontFamily(computedStyle.fontFamily);
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(text);
      const ascent = metrics.actualBoundingBoxAscent;
      const descent = metrics.actualBoundingBoxDescent;
      const measured = ascent + descent;
      if (Number.isFinite(measured) && measured > 0) {
        return Math.max(1, round(measured));
      }
    } catch {
      return Math.max(1, round(fallbackHeight));
    }
    return Math.max(1, round(fallbackHeight));
  };
})();
var getMeasuredTextWidth = /* @__PURE__ */ (() => {
  let ctx = null;
  return (text, computedStyle, fontSize, letterSpacing = 0) => {
    if (!text) return 0;
    try {
      if (!ctx) {
        const canvas = document.createElement("canvas");
        ctx = canvas.getContext("2d");
      }
      if (!ctx) return 0;
      const fontStyle = computedStyle.fontStyle || "normal";
      const fontWeight = computedStyle.fontWeight || "400";
      const fontFamily = normalizePrimaryFontFamily(computedStyle.fontFamily);
      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
      const metrics = ctx.measureText(text);
      const baseWidth = Number.isFinite(metrics.width) ? metrics.width : 0;
      const spacingExtra = Math.max(0, text.length - 1) * Math.max(0, letterSpacing);
      const measured = baseWidth + spacingExtra;
      return Math.max(0, round(measured));
    } catch {
      return 0;
    }
  };
})();
var resolveTextDecorations = (computedStyle) => {
  const rawLine = computedStyle.textDecorationLine || computedStyle.getPropertyValue("text-decoration-line") || computedStyle.textDecoration || "";
  const line = String(rawLine).toLowerCase();
  const underline = line.includes("underline");
  const strikethrough = line.includes("line-through");
  return { underline, strikethrough };
};
var getWeightName = (weight) => {
  if (weight >= 700) return "Bold";
  if (weight >= 600) return "Semibold";
  if (weight >= 500) return "Medium";
  if (weight <= 300) return "Light";
  return "Regular";
};
var normalizePrimaryFontFamily = (fontFamily) => {
  if (!fontFamily) return "Roboto";
  const family = fontFamily.split(",")[0]?.trim() || "Roboto";
  return family.replace(/^["']|["']$/g, "");
};
var getDirectText = (element) => {
  if (isFrameworkPlaceholderElement(element) || isPotentialMeasurementHelperElement(element)) {
    return "";
  }
  const text = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim();
  return text;
};
var getDirectTextRectRelativeToRoot = (element, rootX, rootY) => {
  const textNodes = Array.from(element.childNodes).filter(
    (node) => node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim().length > 0
  );
  if (textNodes.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let hasRect = false;
  let lineCount = 0;
  let maxLineWidth = 0;
  for (const textNode of textNodes) {
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const clientRects = range.getClientRects();
    for (const clientRect of clientRects) {
      if (clientRect.width <= 0 || clientRect.height <= 0) continue;
      const left = clientRect.left + window.scrollX;
      const top = clientRect.top + window.scrollY;
      const right = clientRect.right + window.scrollX;
      const bottom = clientRect.bottom + window.scrollY;
      lineCount += 1;
      maxLineWidth = Math.max(maxLineWidth, clientRect.width);
      minX = Math.min(minX, left);
      minY = Math.min(minY, top);
      maxX = Math.max(maxX, right);
      maxY = Math.max(maxY, bottom);
      hasRect = true;
    }
  }
  if (!hasRect) return null;
  return {
    x: round(minX - rootX),
    y: round(minY - rootY),
    width: round(Math.max(0, maxX - minX)),
    height: round(Math.max(0, maxY - minY)),
    lineCount,
    maxLineWidth: round(Math.max(0, maxLineWidth))
  };
};
var isExportOverlayElement = (element) => {
  if (!(element instanceof Element)) return false;
  if (element.id === EXPORT_OVERLAY_ROOT_ID) return true;
  if (typeof element.closest === "function" && element.closest(`#${EXPORT_OVERLAY_ROOT_ID}`)) {
    return true;
  }
  return false;
};
var REACT_RUNTIME_COMMENT_RE = /^\/?\$[A-Za-z0-9:!?-]*$/;
var MEASUREMENT_HELPER_RE = /\b(measure|measurement|measurer|ruler|sizer|recharts)\b/i;
var FAR_OFFSCREEN_THRESHOLD = 5e3;
var isReactRuntimeCommentNode = (node) => {
  if (!(node instanceof Comment)) return false;
  const marker = String(node.textContent || "").trim();
  if (!marker) return false;
  return REACT_RUNTIME_COMMENT_RE.test(marker);
};
var isFrameworkPlaceholderElement = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const childNodes = Array.from(element.childNodes || []);
  if (childNodes.length === 0 || element.children.length > 0) {
    return false;
  }
  if (String(element.textContent || "").trim().length > 0) {
    return false;
  }
  const hasRuntimeComment = childNodes.some((node) => isReactRuntimeCommentNode(node));
  if (!hasRuntimeComment) {
    return false;
  }
  const allNodesIgnorable = childNodes.every((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return String(node.textContent || "").trim().length === 0;
    }
    if (node.nodeType === Node.COMMENT_NODE) {
      return isReactRuntimeCommentNode(node);
    }
    return false;
  });
  if (!allNodesIgnorable) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return element.hasAttribute("hidden") || style.display === "none" || style.visibility === "hidden" || toNumber(style.opacity, 1) <= 0;
};
var hasMeasurementHelperMarker = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const id = element.id || "";
  const className = typeof element.className === "string" ? element.className : element.className?.baseVal || "";
  const dataTestId = element.getAttribute("data-testid") || "";
  const dataRole = element.getAttribute("data-role") || "";
  const markerText = `${id} ${className} ${dataTestId} ${dataRole}`;
  return MEASUREMENT_HELPER_RE.test(markerText);
};
var isPotentialMeasurementHelperElement = (element) => {
  if (!(element instanceof HTMLElement)) return false;
  const ariaHidden = String(element.getAttribute("aria-hidden") || "").toLowerCase() === "true";
  if (!ariaHidden) return false;
  return hasMeasurementHelperMarker(element);
};
var isFarOffscreenRect = (rect) => {
  if (!rect) return false;
  const viewportWidth = Math.max(window.innerWidth || 0, document.documentElement?.clientWidth || 0);
  const viewportHeight = Math.max(window.innerHeight || 0, document.documentElement?.clientHeight || 0);
  return rect.right < -FAR_OFFSCREEN_THRESHOLD || rect.bottom < -FAR_OFFSCREEN_THRESHOLD || rect.left > viewportWidth + FAR_OFFSCREEN_THRESHOLD || rect.top > viewportHeight + FAR_OFFSCREEN_THRESHOLD;
};
var isOffscreenMeasurementElement = (element, computedStyle = null, rect = null) => {
  if (!(element instanceof HTMLElement)) return false;
  const ariaHidden = String(element.getAttribute("aria-hidden") || "").toLowerCase() === "true";
  if (!ariaHidden) return false;
  const style = computedStyle || window.getComputedStyle(element);
  const position = String(style.position || "").toLowerCase();
  if (position !== "absolute" && position !== "fixed") return false;
  const targetRect = rect || element.getBoundingClientRect();
  const isFarAway = isFarOffscreenRect(targetRect);
  const hasMarker = hasMeasurementHelperMarker(element);
  return isFarAway || hasMarker;
};
var isElementVisible = (element) => {
  if (!(element instanceof HTMLElement || element instanceof SVGElement)) return false;
  const tag = element.tagName.toLowerCase();
  if (HIDDEN_TAGS.has(tag)) return false;
  if (isExportOverlayElement(element)) return false;
  if (isFrameworkPlaceholderElement(element)) return false;
  if (isPotentialMeasurementHelperElement(element)) return false;
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (toNumber(style.opacity, 1) <= 0) return false;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  if (isOffscreenMeasurementElement(element, style, rect)) return false;
  return true;
};
var getElementRectRelativeToRoot = (element, rootX, rootY) => {
  const rect = element.getBoundingClientRect();
  const absoluteX = rect.left + window.scrollX;
  const absoluteY = rect.top + window.scrollY;
  return {
    x: round(absoluteX - rootX),
    y: round(absoluteY - rootY),
    width: round(rect.width),
    height: round(rect.height)
  };
};
var getElementName = (element) => {
  const dataLabel = element.getAttribute("data-label");
  if (dataLabel) return dataLabel.slice(0, 40);
  if (element.id) return element.id.slice(0, 40);
  const aria = element.getAttribute("aria-label");
  if (aria) return aria.slice(0, 40);
  const text = getDirectText(element);
  if (text) return text.slice(0, 40);
  return element.tagName.toLowerCase();
};
var getBackgroundImageUrl = (computedStyle) => {
  const backgroundImage = computedStyle.backgroundImage;
  if (!backgroundImage || backgroundImage === "none") return null;
  const match = backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
  if (!match || !match[2]) return null;
  return match[2];
};
var hasSpecialBorderStyle = (computedStyle) => {
  const styles = [
    computedStyle.borderTopStyle,
    computedStyle.borderRightStyle,
    computedStyle.borderBottomStyle,
    computedStyle.borderLeftStyle
  ].map((value) => (value || "").toLowerCase()).filter(Boolean);
  if (styles.length === 0) return false;
  return styles.some((style) => style !== "none" && style !== "solid");
};
var hasNonUrlBackgroundImage = (computedStyle) => {
  const backgroundImage = computedStyle.backgroundImage;
  if (!backgroundImage || backgroundImage === "none") return false;
  const normalized = backgroundImage.toLowerCase();
  if (normalized.includes("linear-gradient") || normalized.includes("radial-gradient") || normalized.includes("conic-gradient") || normalized.includes("repeating-linear-gradient") || normalized.includes("repeating-radial-gradient")) {
    return true;
  }
  return !normalized.includes("url(");
};
var needsScreenshotFillFallback = (computedStyle) => {
  if (needsScreenshotBackground(computedStyle)) return true;
  if (hasNonUrlBackgroundImage(computedStyle)) return true;
  if (hasSpecialBorderStyle(computedStyle)) return true;
  if ((computedStyle.borderImageSource || "none") !== "none") return true;
  if ((computedStyle.filter || "none") !== "none") return true;
  if ((computedStyle.backdropFilter || computedStyle.webkitBackdropFilter || "none") !== "none") {
    return true;
  }
  return false;
};
var captureElementFillImage = async (element, computedStyle) => {
  try {
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const maxSize = 4096;
    if (rect.width > maxSize || rect.height > maxSize) return null;
    const { snapdom } = await import("@zumer/snapdom");
    const tempEl = element.cloneNode(true);
    if (!(tempEl instanceof HTMLElement || tempEl instanceof SVGElement)) return null;
    if (tempEl instanceof HTMLElement) {
      tempEl.removeAttribute("id");
      for (let i = 0; i < computedStyle.length; i += 1) {
        const prop = computedStyle[i];
        const value = computedStyle.getPropertyValue(prop);
        if (value) {
          tempEl.style.setProperty(prop, value);
        }
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
    }
    Array.from(tempEl.children).forEach((child) => {
      if (child instanceof HTMLElement || child instanceof SVGElement) {
        child.style.visibility = "hidden";
      }
    });
    document.body.appendChild(tempEl);
    const pngImage = await snapdom.toPng(tempEl, {
      fast: false,
      embedFonts: true,
      scale: 1,
      dpr: 1,
      width: rect.width,
      height: rect.height
    });
    tempEl.remove();
    if (!pngImage?.src) return null;
    return pngImage.src;
  } catch (error) {
    console.warn("[htmlToAxure] captureElementFillImage failed, fallback to style mapping", error);
    return null;
  }
};
var captureSvgAsPngDataUrl = async (svgElement) => {
  try {
    const rect = svgElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const maxSize = 4096;
    if (rect.width > maxSize || rect.height > maxSize) return null;
    const { snapdom } = await import("@zumer/snapdom");
    const pngImage = await snapdom.toPng(svgElement, {
      fast: false,
      embedFonts: true,
      scale: 1,
      dpr: 1,
      width: rect.width,
      height: rect.height
    });
    if (!pngImage?.src) return null;
    return pngImage.src;
  } catch (error) {
    console.warn("[htmlToAxure] captureSvgAsPngDataUrl failed", error);
    return null;
  }
};
var getMediaUrl = (element, computedStyle) => {
  const tag = element.tagName.toLowerCase();
  if (tag === "img") {
    return element.currentSrc || element.src || null;
  }
  if (tag === "video") {
    return element.poster || null;
  }
  if (tag === "canvas") {
    try {
      return element.toDataURL("image/png");
    } catch {
      return null;
    }
  }
  return getBackgroundImageUrl(computedStyle);
};
var normalizeImageMapValue = (value) => {
  if (!value) return value;
  const trimmed = value.trim();
  const base64Index = trimmed.indexOf(";base64,");
  if (trimmed.startsWith("data:") && base64Index > 0) {
    return trimmed.slice(base64Index + ";base64,".length);
  }
  return trimmed;
};
var fallbackHash = (input) => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `${hex}${hex}${hex}${hex}${hex}`.slice(0, 40);
};
var sha1Hex = async (input) => {
  if (globalThis.crypto?.subtle) {
    try {
      const encoded = new TextEncoder().encode(input);
      const digest = await globalThis.crypto.subtle.digest("SHA-1", encoded);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    } catch {
      return fallbackHash(input);
    }
  }
  return fallbackHash(input);
};
var createBaseLayerNode = ({ id, name, rect, opacity }) => ({
  itemType: ITEM_TYPE_LAYER,
  flippedHorizontal: false,
  flippedVertical: false,
  id,
  name,
  visible: true,
  isLocked: false,
  isNameDynamic: false,
  rotation: 0,
  rect: {
    location: {
      x: rect.x,
      y: rect.y
    },
    size: {
      width: rect.width,
      height: rect.height
    }
  },
  resizingConstraints: getResizingConstraints(),
  opacity,
  textAlignment: DEFAULT_TEXT_ALIGN,
  textPadding: [],
  effects: [],
  textShadows: [],
  booleanOperation: 0,
  textRotation: 0,
  isMask: false
});
var getBorderInfo = (computedStyle) => {
  const resolveSideBorderWidth = (widthValue, styleValue) => {
    const width = round(Math.max(0, toNumber(widthValue, 0)));
    const style = (styleValue || "").toLowerCase();
    if (style === "none" || style === "hidden") return 0;
    return width;
  };
  const borderTop = resolveSideBorderWidth(computedStyle.borderTopWidth, computedStyle.borderTopStyle);
  const borderRight = resolveSideBorderWidth(computedStyle.borderRightWidth, computedStyle.borderRightStyle);
  const borderBottom = resolveSideBorderWidth(computedStyle.borderBottomWidth, computedStyle.borderBottomStyle);
  const borderLeft = resolveSideBorderWidth(computedStyle.borderLeftWidth, computedStyle.borderLeftStyle);
  const border = [borderTop, borderRight, borderBottom, borderLeft];
  const maxWidth = Math.max(...border);
  const hasBorder = maxWidth > 0;
  const sideStrokeColor = borderTop > 0 && computedStyle.borderTopColor || borderRight > 0 && computedStyle.borderRightColor || borderBottom > 0 && computedStyle.borderBottomColor || borderLeft > 0 && computedStyle.borderLeftColor || computedStyle.borderColor;
  return {
    hasBorder,
    maxWidth,
    strokeColor: sideStrokeColor,
    border
  };
};
var getCornerRadii = (computedStyle) => [
  round(toNumber(computedStyle.borderTopLeftRadius, 0)),
  round(toNumber(computedStyle.borderTopRightRadius, 0)),
  round(toNumber(computedStyle.borderBottomRightRadius, 0)),
  round(toNumber(computedStyle.borderBottomLeftRadius, 0))
];
var hasRoundedCorners = (corners) => corners.some((value) => value > 0.01);
var isOverflowClipping = (computedStyle) => {
  const overflow = (computedStyle.overflow || "").toLowerCase();
  const overflowX = (computedStyle.overflowX || "").toLowerCase();
  const overflowY = (computedStyle.overflowY || "").toLowerCase();
  return OVERFLOW_CLIPPING_VALUES.has(overflow) || OVERFLOW_CLIPPING_VALUES.has(overflowX) || OVERFLOW_CLIPPING_VALUES.has(overflowY);
};
var isNearlySameRect = (a, b, tolerance = 6) => {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance && Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance;
};
var resolveClipContainer = (element, rootPageX, rootPageY, options = {}) => {
  const { includeSelf = false, maxDepth = 6 } = options;
  let depth = 0;
  let candidate = includeSelf ? element : element.parentElement;
  while (candidate && depth < maxDepth) {
    if (isExportOverlayElement(candidate)) {
      candidate = candidate.parentElement;
      depth += 1;
      continue;
    }
    const style = window.getComputedStyle(candidate);
    if (isOverflowClipping(style)) {
      return {
        element: candidate,
        rect: getElementRectRelativeToRoot(candidate, rootPageX, rootPageY),
        corners: getCornerRadii(style)
      };
    }
    candidate = candidate.parentElement;
    depth += 1;
  }
  return null;
};
var resolveMediaClipContainer = (element, rect, rootPageX, rootPageY) => {
  let depth = 0;
  let parent = element.parentElement;
  while (parent && depth < 4) {
    const clipContainer = resolveClipContainer(parent, rootPageX, rootPageY, {
      includeSelf: true,
      maxDepth: 1
    });
    if (clipContainer && hasRoundedCorners(clipContainer.corners)) {
      if (isNearlySameRect(clipContainer.rect, rect)) {
        return {
          rect: clipContainer.rect,
          corners: clipContainer.corners
        };
      }
    }
    parent = parent.parentElement;
    depth += 1;
  }
  return null;
};
var resolveMediaCorners = (element, computedStyle, rect, rootPageX, rootPageY) => {
  const ownCorners = getCornerRadii(computedStyle);
  if (hasRoundedCorners(ownCorners)) {
    return ownCorners;
  }
  const clipContainer = resolveMediaClipContainer(element, rect, rootPageX, rootPageY);
  if (clipContainer?.corners) {
    return clipContainer.corners;
  }
  return ownCorners;
};
var createMaskWrapperNode = ({ id, name, rect, corners, maskedItems }) => ({
  ...createBaseLayerNode({
    id,
    name,
    rect,
    opacity: 1
  }),
  type: 0,
  corners,
  border: [0, 0, 0, 0],
  backgroundFills: [
    {
      type: SOLID_FILL_TYPE,
      enabled: false,
      color: { r: 1, g: 1, b: 1, a: 1 }
    }
  ],
  strokes: [],
  strokePattern: [],
  strokeThickness: 0,
  effects: [],
  isMask: true,
  maskedScene: {
    items: maskedItems
  }
});
var createHierarchyMaskContainerNode = ({ id, name, rect }) => ({
  ...createBaseLayerNode({
    id,
    name,
    rect,
    opacity: 1
  }),
  type: 0,
  corners: [0, 0, 0, 0],
  border: [0, 0, 0, 0],
  backgroundFills: [
    {
      type: SOLID_FILL_TYPE,
      enabled: false,
      color: { r: 1, g: 1, b: 1, a: 1 }
    }
  ],
  strokes: [],
  strokePattern: [],
  strokeThickness: 0,
  effects: [],
  textShadows: [],
  isMask: true,
  maskedScene: {
    items: []
  }
});
var createHierarchyGroupContainerNode = ({ id, name, rect }) => ({
  id,
  name,
  itemType: ITEM_TYPE_GROUP,
  visible: true,
  isLocked: false,
  isNameDynamic: false,
  rotation: 0,
  rect: {
    location: {
      x: rect.x,
      y: rect.y
    },
    size: {
      width: rect.width,
      height: rect.height
    }
  },
  resizingConstraints: getResizingConstraints(),
  effects: [],
  isMask: false,
  flippedHorizontal: false,
  flippedVertical: false,
  opacity: 1,
  scene: {
    items: []
  }
});
var getContainerItems = (containerNode) => {
  if (!containerNode || typeof containerNode !== "object") return null;
  if (Number(containerNode.itemType) === ITEM_TYPE_GROUP) {
    if (!containerNode.scene || !Array.isArray(containerNode.scene.items)) {
      containerNode.scene = { items: [] };
    }
    return containerNode.scene.items;
  }
  if (containerNode.maskedScene && Array.isArray(containerNode.maskedScene.items)) {
    return containerNode.maskedScene.items;
  }
  return null;
};
var shouldCreateRectangle = (element, computedStyle) => {
  const tag = element.tagName.toLowerCase();
  if (tag === "svg") return false;
  if (MEDIA_TAGS.has(tag)) return true;
  if (!isTransparentColor(computedStyle.backgroundColor)) return true;
  if (computedStyle.backgroundImage && computedStyle.backgroundImage !== "none") return true;
  if (getBackgroundImageUrl(computedStyle)) return true;
  if (needsScreenshotFillFallback(computedStyle)) return true;
  const border = getBorderInfo(computedStyle);
  if (border.hasBorder) return true;
  return false;
};
var createBackgroundShape = (id, artboardWidth, artboardHeight, backgroundFill) => ({
  itemType: ITEM_TYPE_LAYER,
  flippedHorizontal: false,
  flippedVertical: false,
  id,
  name: "Background",
  visible: true,
  isLocked: true,
  isNameDynamic: false,
  rotation: 0,
  rect: {
    location: { x: 0, y: 0 },
    size: { width: artboardWidth, height: artboardHeight }
  },
  resizingConstraints: {
    hasFixedLeft: true,
    hasFixedRight: true,
    hasFixedTop: true,
    hasFixedBottom: true,
    hasFixedWidth: false,
    hasFixedHeight: false
  },
  strokes: [],
  strokeThickness: 0,
  strokePattern: [],
  type: 0,
  backgroundFills: [backgroundFill],
  opacity: 1,
  booleanOperation: 0,
  corners: [0, 0, 0, 0],
  border: [1, 1, 1, 1],
  textAlignment: DEFAULT_TEXT_ALIGN,
  textPadding: [],
  effects: [],
  textShadows: [],
  textRotation: 0,
  isMask: false
});
var isSvgGeometryVisible = (geometryElement) => {
  const style = window.getComputedStyle(geometryElement);
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (toNumber(style.opacity, 1) <= 0) return false;
  return true;
};
var normalizePathPoint = (value, origin, size) => {
  if (!Number.isFinite(value) || !Number.isFinite(origin)) return 0;
  if (!Number.isFinite(size) || size <= 0) return 0;
  return round((value - origin) / size);
};
var getSvgGeometryClientPoints = (geometryElement) => {
  const ownerSvg = geometryElement.ownerSVGElement;
  if (!ownerSvg || typeof ownerSvg.createSVGPoint !== "function") {
    return [];
  }
  const getTotalLength = geometryElement.getTotalLength;
  const getPointAtLength = geometryElement.getPointAtLength;
  if (typeof getTotalLength !== "function" || typeof getPointAtLength !== "function") {
    return [];
  }
  const ctm = geometryElement.getScreenCTM();
  if (!ctm) return [];
  let totalLength = 0;
  try {
    totalLength = getTotalLength.call(geometryElement);
  } catch {
    return [];
  }
  if (!Number.isFinite(totalLength) || totalLength < 0) {
    return [];
  }
  const sampleCount = Math.max(2, Math.min(240, Math.ceil(totalLength / 6) + 1));
  const sampled = [];
  for (let i = 0; i < sampleCount; i += 1) {
    const ratio = sampleCount === 1 ? 0 : i / (sampleCount - 1);
    const distance = totalLength * ratio;
    let point = null;
    try {
      point = getPointAtLength.call(geometryElement, distance);
    } catch {
      point = null;
    }
    if (!point) continue;
    const svgPoint = ownerSvg.createSVGPoint();
    svgPoint.x = point.x;
    svgPoint.y = point.y;
    const transformed = svgPoint.matrixTransform(ctm);
    sampled.push({
      x: transformed.x,
      y: transformed.y
    });
  }
  const deduped = [];
  for (const point of sampled) {
    const prev = deduped[deduped.length - 1];
    if (!prev || Math.abs(prev.x - point.x) > 1e-3 || Math.abs(prev.y - point.y) > 1e-3) {
      deduped.push(point);
    }
  }
  return deduped;
};
var tokenizePathData = (pathData) => {
  const tokens = [];
  if (!pathData) return tokens;
  const regex = /([AaCcHhLlMmQqSsTtVvZz])|([+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?)/g;
  let match = regex.exec(pathData);
  while (match) {
    if (match[1]) {
      tokens.push(match[1]);
    } else if (match[2]) {
      const value = Number.parseFloat(match[2]);
      if (Number.isFinite(value)) {
        tokens.push(value);
      }
    }
    match = regex.exec(pathData);
  }
  return tokens;
};
var reflectPoint = (point, origin) => ({
  x: 2 * origin.x - point.x,
  y: 2 * origin.y - point.y
});
var toCubicFromQuadratic = (start, control, end) => ({
  c1: {
    x: start.x + (control.x - start.x) * 2 / 3,
    y: start.y + (control.y - start.y) * 2 / 3
  },
  c2: {
    x: end.x + (control.x - end.x) * 2 / 3,
    y: end.y + (control.y - end.y) * 2 / 3
  }
});
var parsePathDataToSegments = (pathData) => {
  const tokens = tokenizePathData(pathData);
  const paths = [];
  if (tokens.length === 0) return paths;
  let tokenIndex = 0;
  let activeCommand = null;
  let currentPoint = { x: 0, y: 0 };
  let subpathStart = { x: 0, y: 0 };
  let lastCubicControl = null;
  let lastQuadraticControl = null;
  let currentPath = null;
  let hasUnsupportedArc = false;
  const hasNumber = () => typeof tokens[tokenIndex] === "number";
  const readNumber = () => {
    const token = tokens[tokenIndex];
    if (typeof token !== "number") return null;
    tokenIndex += 1;
    return token;
  };
  const ensurePath = () => {
    if (!currentPath) {
      currentPath = {
        closed: false,
        data: [],
        endDecoration: 1,
        startDecoration: 1
      };
      paths.push(currentPath);
    }
    return currentPath;
  };
  const appendPoint = (point, type = 2, lowerHandle, higherHandle) => {
    const path = ensurePath();
    const entry = {
      type,
      to: {
        x: point.x,
        y: point.y
      }
    };
    if (lowerHandle) {
      entry.lowerHandle = { x: lowerHandle.x, y: lowerHandle.y };
    }
    if (higherHandle) {
      entry.higherHandle = { x: higherHandle.x, y: higherHandle.y };
    }
    path.data.push(entry);
    return entry;
  };
  const setHigherHandleOnLastPoint = (handlePoint) => {
    const path = ensurePath();
    const lastPoint = path.data[path.data.length - 1];
    if (!lastPoint) return;
    lastPoint.type = 3;
    lastPoint.higherHandle = {
      x: handlePoint.x,
      y: handlePoint.y
    };
  };
  while (tokenIndex < tokens.length) {
    const token = tokens[tokenIndex];
    if (typeof token === "string") {
      activeCommand = token;
      tokenIndex += 1;
    } else if (!activeCommand) {
      tokenIndex += 1;
      continue;
    }
    const isRelative = activeCommand === activeCommand.toLowerCase();
    const command = activeCommand.toUpperCase();
    if (command === "Z") {
      if (currentPath) {
        currentPath.closed = true;
      }
      currentPoint = { x: subpathStart.x, y: subpathStart.y };
      lastCubicControl = null;
      lastQuadraticControl = null;
      activeCommand = null;
      continue;
    }
    if (command === "M") {
      const x = readNumber();
      const y = readNumber();
      if (x === null || y === null) break;
      const moveTo = {
        x: isRelative ? currentPoint.x + x : x,
        y: isRelative ? currentPoint.y + y : y
      };
      currentPath = {
        closed: false,
        data: [],
        endDecoration: 1,
        startDecoration: 1
      };
      paths.push(currentPath);
      appendPoint(moveTo, 2);
      currentPoint = moveTo;
      subpathStart = moveTo;
      lastCubicControl = null;
      lastQuadraticControl = null;
      while (hasNumber()) {
        const lx = readNumber();
        const ly = readNumber();
        if (lx === null || ly === null) break;
        const lineTo = {
          x: isRelative ? currentPoint.x + lx : lx,
          y: isRelative ? currentPoint.y + ly : ly
        };
        appendPoint(lineTo, 2);
        currentPoint = lineTo;
      }
      continue;
    }
    if (command === "L") {
      while (hasNumber()) {
        const x = readNumber();
        const y = readNumber();
        if (x === null || y === null) break;
        const lineTo = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y
        };
        appendPoint(lineTo, 2);
        currentPoint = lineTo;
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }
    if (command === "H") {
      while (hasNumber()) {
        const x = readNumber();
        if (x === null) break;
        const lineTo = {
          x: isRelative ? currentPoint.x + x : x,
          y: currentPoint.y
        };
        appendPoint(lineTo, 2);
        currentPoint = lineTo;
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }
    if (command === "V") {
      while (hasNumber()) {
        const y = readNumber();
        if (y === null) break;
        const lineTo = {
          x: currentPoint.x,
          y: isRelative ? currentPoint.y + y : y
        };
        appendPoint(lineTo, 2);
        currentPoint = lineTo;
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }
    if (command === "C") {
      while (hasNumber()) {
        const x1 = readNumber();
        const y1 = readNumber();
        const x2 = readNumber();
        const y2 = readNumber();
        const x = readNumber();
        const y = readNumber();
        if ([x1, y1, x2, y2, x, y].some((value) => value === null)) break;
        const c1 = {
          x: isRelative ? currentPoint.x + x1 : x1,
          y: isRelative ? currentPoint.y + y1 : y1
        };
        const c2 = {
          x: isRelative ? currentPoint.x + x2 : x2,
          y: isRelative ? currentPoint.y + y2 : y2
        };
        const end = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y
        };
        setHigherHandleOnLastPoint(c1);
        appendPoint(end, 3, c2);
        currentPoint = end;
        lastCubicControl = c2;
        lastQuadraticControl = null;
      }
      continue;
    }
    if (command === "S") {
      while (hasNumber()) {
        const x2 = readNumber();
        const y2 = readNumber();
        const x = readNumber();
        const y = readNumber();
        if ([x2, y2, x, y].some((value) => value === null)) break;
        const c1 = lastCubicControl ? reflectPoint(lastCubicControl, currentPoint) : currentPoint;
        const c2 = {
          x: isRelative ? currentPoint.x + x2 : x2,
          y: isRelative ? currentPoint.y + y2 : y2
        };
        const end = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y
        };
        setHigherHandleOnLastPoint(c1);
        appendPoint(end, 3, c2);
        currentPoint = end;
        lastCubicControl = c2;
        lastQuadraticControl = null;
      }
      continue;
    }
    if (command === "Q") {
      while (hasNumber()) {
        const x1 = readNumber();
        const y1 = readNumber();
        const x = readNumber();
        const y = readNumber();
        if ([x1, y1, x, y].some((value) => value === null)) break;
        const control = {
          x: isRelative ? currentPoint.x + x1 : x1,
          y: isRelative ? currentPoint.y + y1 : y1
        };
        const end = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y
        };
        const cubic = toCubicFromQuadratic(currentPoint, control, end);
        setHigherHandleOnLastPoint(cubic.c1);
        appendPoint(end, 3, cubic.c2);
        currentPoint = end;
        lastQuadraticControl = control;
        lastCubicControl = null;
      }
      continue;
    }
    if (command === "T") {
      while (hasNumber()) {
        const x = readNumber();
        const y = readNumber();
        if ([x, y].some((value) => value === null)) break;
        const control = lastQuadraticControl ? reflectPoint(lastQuadraticControl, currentPoint) : currentPoint;
        const end = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y
        };
        const cubic = toCubicFromQuadratic(currentPoint, control, end);
        setHigherHandleOnLastPoint(cubic.c1);
        appendPoint(end, 3, cubic.c2);
        currentPoint = end;
        lastQuadraticControl = control;
        lastCubicControl = null;
      }
      continue;
    }
    if (command === "A") {
      hasUnsupportedArc = true;
      while (hasNumber()) {
        const rx = readNumber();
        const ry = readNumber();
        const rotation = readNumber();
        const largeArc = readNumber();
        const sweep = readNumber();
        const x = readNumber();
        const y = readNumber();
        if ([rx, ry, rotation, largeArc, sweep, x, y].some((value) => value === null)) break;
        const end = {
          x: isRelative ? currentPoint.x + x : x,
          y: isRelative ? currentPoint.y + y : y
        };
        appendPoint(end, 2);
        currentPoint = end;
      }
      lastCubicControl = null;
      lastQuadraticControl = null;
      continue;
    }
    activeCommand = null;
  }
  if (hasUnsupportedArc) {
    return [];
  }
  return paths.filter((path) => Array.isArray(path.data) && path.data.length >= 2);
};
var parseSvgPointsAttr = (value) => {
  if (!value) return [];
  const nums = [];
  const regex = /[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/g;
  let match = regex.exec(value);
  while (match) {
    const num = Number.parseFloat(match[0]);
    if (Number.isFinite(num)) {
      nums.push(num);
    }
    match = regex.exec(value);
  }
  const points = [];
  for (let index = 0; index + 1 < nums.length; index += 2) {
    points.push({
      x: nums[index],
      y: nums[index + 1]
    });
  }
  return points;
};
var buildEllipsePathSegments = (cx, cy, rx, ry) => {
  if (rx <= 0 || ry <= 0) return [];
  const k = 0.5522847498307936;
  const p0 = { x: cx + rx, y: cy };
  const p1 = { x: cx, y: cy + ry };
  const p2 = { x: cx - rx, y: cy };
  const p3 = { x: cx, y: cy - ry };
  const c1 = { x: cx + rx, y: cy + ry * k };
  const c2 = { x: cx + rx * k, y: cy + ry };
  const c3 = { x: cx - rx * k, y: cy + ry };
  const c4 = { x: cx - rx, y: cy + ry * k };
  const c5 = { x: cx - rx, y: cy - ry * k };
  const c6 = { x: cx - rx * k, y: cy - ry };
  const c7 = { x: cx + rx * k, y: cy - ry };
  const c8 = { x: cx + rx, y: cy - ry * k };
  return [
    {
      closed: true,
      endDecoration: 1,
      startDecoration: 1,
      data: [
        { type: 3, to: p0, higherHandle: c1 },
        { type: 3, to: p1, lowerHandle: c2, higherHandle: c3 },
        { type: 3, to: p2, lowerHandle: c4, higherHandle: c5 },
        { type: 3, to: p3, lowerHandle: c6, higherHandle: c7 },
        { type: 3, to: p0, lowerHandle: c8 }
      ]
    }
  ];
};
var getSvgGeometryLocalSegments = (geometryElement) => {
  const tag = geometryElement.tagName.toLowerCase();
  if (tag === "path") {
    const d = geometryElement.getAttribute("d") || "";
    return parsePathDataToSegments(d);
  }
  if (tag === "line") {
    const x1 = toNumber(geometryElement.getAttribute("x1"), 0);
    const y1 = toNumber(geometryElement.getAttribute("y1"), 0);
    const x2 = toNumber(geometryElement.getAttribute("x2"), 0);
    const y2 = toNumber(geometryElement.getAttribute("y2"), 0);
    return [
      {
        closed: false,
        endDecoration: 1,
        startDecoration: 1,
        data: [
          { type: 2, to: { x: x1, y: y1 } },
          { type: 2, to: { x: x2, y: y2 } }
        ]
      }
    ];
  }
  if (tag === "polyline" || tag === "polygon") {
    const points = parseSvgPointsAttr(geometryElement.getAttribute("points") || "");
    if (points.length < 2) return [];
    return [
      {
        closed: tag === "polygon",
        endDecoration: 1,
        startDecoration: 1,
        data: points.map((point) => ({ type: 2, to: point }))
      }
    ];
  }
  if (tag === "rect") {
    const x = toNumber(geometryElement.getAttribute("x"), 0);
    const y = toNumber(geometryElement.getAttribute("y"), 0);
    const width = toNumber(geometryElement.getAttribute("width"), 0);
    const height = toNumber(geometryElement.getAttribute("height"), 0);
    if (width <= 0 || height <= 0) return [];
    return [
      {
        closed: true,
        endDecoration: 1,
        startDecoration: 1,
        data: [
          { type: 2, to: { x, y } },
          { type: 2, to: { x: x + width, y } },
          { type: 2, to: { x: x + width, y: y + height } },
          { type: 2, to: { x, y: y + height } }
        ]
      }
    ];
  }
  if (tag === "circle") {
    const cx = toNumber(geometryElement.getAttribute("cx"), 0);
    const cy = toNumber(geometryElement.getAttribute("cy"), 0);
    const r = toNumber(geometryElement.getAttribute("r"), 0);
    return buildEllipsePathSegments(cx, cy, r, r);
  }
  if (tag === "ellipse") {
    const cx = toNumber(geometryElement.getAttribute("cx"), 0);
    const cy = toNumber(geometryElement.getAttribute("cy"), 0);
    const rx = toNumber(geometryElement.getAttribute("rx"), 0);
    const ry = toNumber(geometryElement.getAttribute("ry"), 0);
    return buildEllipsePathSegments(cx, cy, rx, ry);
  }
  return [];
};
var transformLocalPointToClient = (ownerSvg, ctm, point) => {
  const svgPoint = ownerSvg.createSVGPoint();
  svgPoint.x = point.x;
  svgPoint.y = point.y;
  const transformed = svgPoint.matrixTransform(ctm);
  return {
    x: transformed.x,
    y: transformed.y
  };
};
var normalizeSegmentDataToRect = (segmentData, clientRect) => {
  return segmentData.map((point) => {
    const normalizedPoint = {
      type: point.type,
      to: {
        x: normalizePathPoint(point.to.x, clientRect.left, clientRect.width),
        y: normalizePathPoint(point.to.y, clientRect.top, clientRect.height)
      }
    };
    if (point.lowerHandle) {
      normalizedPoint.lowerHandle = {
        x: normalizePathPoint(point.lowerHandle.x, clientRect.left, clientRect.width),
        y: normalizePathPoint(point.lowerHandle.y, clientRect.top, clientRect.height)
      };
    }
    if (point.higherHandle) {
      normalizedPoint.higherHandle = {
        x: normalizePathPoint(point.higherHandle.x, clientRect.left, clientRect.width),
        y: normalizePathPoint(point.higherHandle.y, clientRect.top, clientRect.height)
      };
    }
    return normalizedPoint;
  });
};
var buildSvgVectorNode = (geometryElement, rootPageX, rootPageY, nextId) => {
  const ownerSvg = geometryElement.ownerSVGElement;
  if (!ownerSvg) return null;
  const ctm = geometryElement.getScreenCTM();
  if (!ctm) return null;
  const clientRect = geometryElement.getBoundingClientRect();
  if (!Number.isFinite(clientRect.left) || !Number.isFinite(clientRect.top)) return null;
  if (clientRect.width <= 0 && clientRect.height <= 0) return null;
  const style = window.getComputedStyle(geometryElement);
  const localSegments = getSvgGeometryLocalSegments(geometryElement);
  let normalizedSegments = [];
  if (localSegments.length > 0) {
    normalizedSegments = localSegments.map((segment) => {
      const transformedData = (segment.data || []).map((point) => {
        const transformedPoint = transformLocalPointToClient(ownerSvg, ctm, point.to);
        const result = {
          type: point.type,
          to: transformedPoint
        };
        if (point.lowerHandle) {
          result.lowerHandle = transformLocalPointToClient(ownerSvg, ctm, point.lowerHandle);
        }
        if (point.higherHandle) {
          result.higherHandle = transformLocalPointToClient(ownerSvg, ctm, point.higherHandle);
        }
        return result;
      });
      if (transformedData.length < 2) return null;
      return {
        closed: Boolean(segment.closed),
        endDecoration: 1,
        startDecoration: 1,
        data: normalizeSegmentDataToRect(transformedData, clientRect)
      };
    }).filter(Boolean);
  }
  if (normalizedSegments.length === 0) {
    const fallbackPoints = getSvgGeometryClientPoints(geometryElement);
    if (fallbackPoints.length < 2) return null;
    normalizedSegments = [
      {
        closed: false,
        endDecoration: 1,
        startDecoration: 1,
        data: normalizeSegmentDataToRect(
          fallbackPoints.map((point) => ({ type: 2, to: point })),
          clientRect
        )
      }
    ];
  }
  const strokeWidth = Math.max(0, round(toNumber(style.strokeWidth, 0)));
  const strokeFill = getSolidFill(style.stroke, true);
  const fillColor = style.fill;
  const fill = fillColor && fillColor !== "none" ? getSolidFill(fillColor, true) : null;
  const opacity = Math.min(1, Math.max(0, toNumber(style.opacity, 1)));
  const rect = {
    x: round(clientRect.left + window.scrollX - rootPageX),
    y: round(clientRect.top + window.scrollY - rootPageY),
    width: round(clientRect.width),
    height: round(clientRect.height)
  };
  return {
    ...createBaseLayerNode({
      id: nextId(),
      name: geometryElement.getAttribute("id") || geometryElement.getAttribute("data-label") || "Vector",
      rect,
      opacity
    }),
    resizingConstraints: getFreeResizingConstraints(),
    type: 2,
    backgroundFills: fill ? [fill] : [],
    strokes: strokeFill && strokeWidth > 0 ? [createStroke(strokeFill, 1)] : [],
    strokeThickness: strokeFill && strokeWidth > 0 ? strokeWidth : 0,
    strokePattern: [],
    textAlignment: 1,
    paths: normalizedSegments,
    svgPaths: []
  };
};
var buildSvgContainerNode = (svgElement, rootPageX, rootPageY, nextId) => {
  const rect = getElementRectRelativeToRoot(svgElement, rootPageX, rootPageY);
  if (rect.width <= 0 || rect.height <= 0) return null;
  const selector = Array.from(SVG_GEOMETRY_TAGS).join(",");
  const geometryElements = svgElement.querySelectorAll(selector);
  const hasSvgGeometryClass = typeof SVGGeometryElement !== "undefined";
  const vectorItems = [];
  for (const geometryElement of geometryElements) {
    if (!(geometryElement instanceof SVGElement)) continue;
    if (geometryElement.ownerSVGElement !== svgElement) continue;
    if (hasSvgGeometryClass && !(geometryElement instanceof SVGGeometryElement)) continue;
    if (isExportOverlayElement(geometryElement)) continue;
    if (!isSvgGeometryVisible(geometryElement)) continue;
    const vectorNode = buildSvgVectorNode(geometryElement, rootPageX, rootPageY, nextId);
    if (vectorNode) {
      vectorItems.push(vectorNode);
    }
  }
  if (vectorItems.length === 0) return null;
  const style = window.getComputedStyle(svgElement);
  const opacity = Math.min(1, Math.max(0, toNumber(style.opacity, 1)));
  return {
    ...createBaseLayerNode({
      id: nextId(),
      name: "SVG",
      rect,
      opacity
    }),
    type: 0,
    corners: [0, 0, 0, 0],
    border: [1, 1, 1, 1],
    backgroundFills: [
      {
        type: SOLID_FILL_TYPE,
        enabled: false,
        color: { r: 1, g: 1, b: 1, a: 1 }
      }
    ],
    strokes: [],
    strokePattern: [],
    strokeThickness: 0,
    textAlignment: 1,
    isMask: true,
    maskedScene: {
      items: vectorItems
    }
  };
};
var buildSvgImageNode = async (svgElement, computedStyle, rootPageX, rootPageY, nextId, registerImage) => {
  const rect = getElementRectRelativeToRoot(svgElement, rootPageX, rootPageY);
  if (rect.width <= 0 || rect.height <= 0) return null;
  const svgPngDataUrl = await captureSvgAsPngDataUrl(svgElement);
  if (!svgPngDataUrl) return null;
  const imageHash = await registerImage(svgPngDataUrl);
  if (!imageHash) return null;
  const opacity = Math.min(1, Math.max(0, toNumber(computedStyle.opacity, 1)));
  return {
    ...createBaseLayerNode({
      id: nextId(),
      name: "SVG",
      rect,
      opacity
    }),
    type: 0,
    corners: [0, 0, 0, 0],
    border: [1, 1, 1, 1],
    backgroundFills: [
      {
        type: IMAGE_FILL_TYPE,
        enabled: true,
        image: imageHash,
        isHash: true,
        patternFillType: 4,
        alignment: { horizontal: 1, vertical: 1 }
      }
    ],
    strokes: [],
    strokePattern: [],
    strokeThickness: 0,
    textAlignment: 1
  };
};
async function htmlToAxure(selector = "body", options = {}) {
  const {
    rootName = document.title || "Page",
    useCustomSize = false,
    targetWidth,
    targetHeight,
    preserveHierarchy = false,
    preserveSvgIcons = true
  } = options || {};
  const rootElement = selector instanceof HTMLElement || selector instanceof SVGElement ? selector : document.querySelector(selector || "body");
  if (!rootElement) {
    throw new Error("htmlToAxure: target element not found");
  }
  try {
    await convertImagesInPage(rootElement);
  } catch (error) {
    console.warn("[htmlToAxure] convertImagesInPage failed, continue:", error);
  }
  const rootRect = rootElement.getBoundingClientRect();
  const rootPageX = rootRect.left + window.scrollX;
  const rootPageY = rootRect.top + window.scrollY;
  const pageSize = getPageSize();
  const artboardWidth = useCustomSize && Number.isFinite(targetWidth) && targetWidth > 0 ? round(targetWidth) : pageSize.width;
  const artboardHeight = useCustomSize && Number.isFinite(targetHeight) && targetHeight > 0 ? round(targetHeight) : pageSize.height;
  const imageMap = {};
  const sceneItems = [];
  let idCounter = 10;
  const nextId = () => `1-${idCounter++}`;
  const hierarchyContainerMap = preserveHierarchy ? /* @__PURE__ */ new WeakMap() : null;
  const registerImage = async (imageUrl) => {
    if (!imageUrl) return null;
    let normalizedUrl = imageUrl;
    if (!normalizedUrl.startsWith("data:")) {
      try {
        normalizedUrl = new URL(normalizedUrl, document.baseURI).href;
      } catch {
        normalizedUrl = imageUrl;
      }
    }
    const imageValue = normalizeImageMapValue(normalizedUrl);
    const hash = await sha1Hex(imageValue);
    if (!imageMap[hash]) {
      imageMap[hash] = imageValue;
    }
    return hash;
  };
  const getTargetItemsForElement = (element, rect, nodeName, computedStyle) => {
    if (!preserveHierarchy) {
      return sceneItems;
    }
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
      return sceneItems;
    }
    if (element === rootElement) {
      return sceneItems;
    }
    const existingContainer = hierarchyContainerMap?.get(element);
    if (existingContainer) {
      return getContainerItems(existingContainer) || sceneItems;
    }
    let styleForContainer = computedStyle;
    if (!styleForContainer) {
      try {
        styleForContainer = window.getComputedStyle(element);
      } catch {
        styleForContainer = null;
      }
    }
    const useMaskContainer = styleForContainer ? isOverflowClipping(styleForContainer) : false;
    const containerNode = (useMaskContainer ? createHierarchyMaskContainerNode : createHierarchyGroupContainerNode)({
      id: nextId(),
      name: `${nodeName || getElementName(element)}-hierarchy`,
      rect
    });
    let parentItems = sceneItems;
    const parentElement = element.parentElement;
    if (parentElement && parentElement !== rootElement) {
      const parentContainer = hierarchyContainerMap?.get(parentElement);
      const parentContainerItems = getContainerItems(parentContainer);
      if (parentContainerItems) {
        parentItems = parentContainerItems;
      }
    }
    parentItems.push(containerNode);
    hierarchyContainerMap?.set(element, containerNode);
    return getContainerItems(containerNode) || parentItems;
  };
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (!(node instanceof Element)) {
        return NodeFilter.FILTER_SKIP;
      }
      if (isFrameworkPlaceholderElement(node) || isPotentialMeasurementHelperElement(node)) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let currentElement = rootElement;
  while (currentElement) {
    if (currentElement instanceof SVGElement && currentElement.ownerSVGElement) {
      currentElement = walker.nextNode();
      continue;
    }
    if (isElementVisible(currentElement)) {
      const computedStyle = window.getComputedStyle(currentElement);
      const rect = getElementRectRelativeToRoot(currentElement, rootPageX, rootPageY);
      if (rect.width > 0 && rect.height > 0) {
        const opacity = Math.min(1, Math.max(0, toNumber(computedStyle.opacity, 1)));
        const nodeName = getElementName(currentElement);
        const elementTag = currentElement.tagName.toLowerCase();
        const targetItems = getTargetItemsForElement(currentElement, rect, nodeName, computedStyle);
        if (elementTag === "svg") {
          let svgNode = null;
          if (preserveSvgIcons) {
            svgNode = buildSvgContainerNode(currentElement, rootPageX, rootPageY, nextId);
          }
          if (!svgNode) {
            svgNode = await buildSvgImageNode(
              currentElement,
              computedStyle,
              rootPageX,
              rootPageY,
              nextId,
              registerImage
            );
          }
          if (svgNode) {
            const clipContainer = preserveHierarchy ? resolveClipContainer(currentElement, rootPageX, rootPageY, {
              includeSelf: false
            }) : null;
            if (clipContainer) {
              const maskNode = createMaskWrapperNode({
                id: nextId(),
                name: `${nodeName}-svg-clip-mask`,
                rect: clipContainer.rect,
                corners: clipContainer.corners,
                maskedItems: [svgNode]
              });
              targetItems.push(maskNode);
            } else {
              targetItems.push(svgNode);
            }
          }
          currentElement = walker.nextNode();
          continue;
        }
        if (shouldCreateRectangle(currentElement, computedStyle)) {
          const layerId = nextId();
          const borderInfo = getBorderInfo(computedStyle);
          const fills = [];
          let useScreenshotFill = false;
          if (needsScreenshotFillFallback(computedStyle)) {
            const screenshotUrl = await captureElementFillImage(currentElement, computedStyle);
            if (screenshotUrl) {
              const hash = await registerImage(screenshotUrl);
              if (hash) {
                fills.push({
                  type: IMAGE_FILL_TYPE,
                  enabled: true,
                  image: hash,
                  isHash: true,
                  patternFillType: 4,
                  alignment: { horizontal: 1, vertical: 1 }
                });
                useScreenshotFill = true;
              }
            }
          }
          if (!useScreenshotFill) {
            const mediaUrl = getMediaUrl(currentElement, computedStyle);
            if (mediaUrl) {
              const hash = await registerImage(mediaUrl);
              if (hash) {
                fills.push({
                  type: IMAGE_FILL_TYPE,
                  enabled: true,
                  image: hash,
                  isHash: true,
                  patternFillType: 4,
                  alignment: { horizontal: 1, vertical: 1 }
                });
              }
            }
            const solidFill = getSolidFill(computedStyle.backgroundColor, true);
            if (solidFill) {
              fills.push(solidFill);
            }
          }
          const ownCorners = getCornerRadii(computedStyle);
          const mediaClipContainer = MEDIA_TAGS.has(elementTag) && !hasRoundedCorners(ownCorners) ? resolveMediaClipContainer(currentElement, rect, rootPageX, rootPageY) : null;
          const corners = MEDIA_TAGS.has(elementTag) ? resolveMediaCorners(currentElement, computedStyle, rect, rootPageX, rootPageY) : ownCorners;
          const rectangle = {
            ...createBaseLayerNode({
              id: layerId,
              name: nodeName,
              rect,
              opacity
            }),
            type: 0,
            corners,
            border: borderInfo.border,
            backgroundFills: fills,
            strokes: [],
            strokePattern: [],
            strokeThickness: useScreenshotFill ? 0 : borderInfo.hasBorder ? borderInfo.maxWidth : 0,
            effects: parseShadowList(computedStyle.boxShadow)
          };
          if (!useScreenshotFill && borderInfo.hasBorder) {
            const borderFill = getSolidFill(borderInfo.strokeColor, true);
            const stroke = createStroke(borderFill, 0);
            if (stroke) {
              rectangle.strokes = [stroke];
            }
          }
          const clipContainer = preserveHierarchy ? resolveClipContainer(currentElement, rootPageX, rootPageY, {
            includeSelf: false
          }) : null;
          if (clipContainer) {
            const wrappedRectangle = {
              ...rectangle,
              corners: ownCorners
            };
            const maskNode = createMaskWrapperNode({
              id: nextId(),
              name: `${nodeName}-clip-mask`,
              rect: clipContainer.rect,
              corners: clipContainer.corners,
              maskedItems: [wrappedRectangle]
            });
            targetItems.push(maskNode);
          } else if (mediaClipContainer && fills.some((fill) => Number(fill?.type) === IMAGE_FILL_TYPE && fill?.enabled !== false)) {
            const wrappedRectangle = {
              ...rectangle,
              corners: ownCorners
            };
            const maskNode = createMaskWrapperNode({
              id: nextId(),
              name: `${nodeName}-mask`,
              rect: mediaClipContainer.rect,
              corners: mediaClipContainer.corners,
              maskedItems: [wrappedRectangle]
            });
            targetItems.push(maskNode);
          } else {
            targetItems.push(rectangle);
          }
        }
        const textContent = getDirectText(currentElement);
        if (textContent) {
          const layerId = nextId();
          const directTextRect = getDirectTextRectRelativeToRoot(currentElement, rootPageX, rootPageY);
          const fontSize = Math.max(1, toNumber(computedStyle.fontSize, 14));
          const lineHeightCss = computedStyle.lineHeight;
          const hasExplicitLineHeight = Boolean(lineHeightCss && lineHeightCss !== "normal");
          const explicitLineHeight = hasExplicitLineHeight ? Math.max(0, toNumber(lineHeightCss, fontSize)) : 0;
          const resolvedLineHeight = hasExplicitLineHeight ? Math.max(fontSize, explicitLineHeight) : round(fontSize * 1.4);
          const fontWeight = Math.max(100, Math.min(900, toNumber(computedStyle.fontWeight, 400)));
          const primaryFamily = normalizePrimaryFontFamily(computedStyle.fontFamily);
          const textColor = parseCssColor(computedStyle.color) || {
            r: 0,
            g: 0,
            b: 0,
            a: 1
          };
          const defaultTextAlign = mapTextAlign(computedStyle.textAlign);
          const flexTextAlignment = resolveFlexTextAlignment(computedStyle);
          const textAlign = flexTextAlignment ? flexTextAlignment.horizontalTextAlign : defaultTextAlign;
          const { underline, strikethrough } = resolveTextDecorations(computedStyle);
          const boxOffsets = getBoxOffsets(computedStyle);
          const contentX = rect.x + boxOffsets.borderLeft + boxOffsets.paddingLeft;
          const contentY = rect.y + boxOffsets.borderTop + boxOffsets.paddingTop;
          const contentWidth = Math.max(
            1,
            round(
              rect.width - boxOffsets.borderLeft - boxOffsets.borderRight - boxOffsets.paddingLeft - boxOffsets.paddingRight
            )
          );
          const contentHeight = Math.max(
            1,
            round(
              rect.height - boxOffsets.borderTop - boxOffsets.borderBottom - boxOffsets.paddingTop - boxOffsets.paddingBottom
            )
          );
          const lineBoxCenteringCandidate = hasExplicitLineHeight && explicitLineHeight > fontSize + 0.5 && Math.abs(explicitLineHeight - contentHeight) <= 2;
          const textHeightBase = lineHeightCss && lineHeightCss !== "normal" ? Math.max(fontSize, Math.min(resolvedLineHeight, fontSize * 1.25)) : Math.max(fontSize, fontSize * 1.2);
          const measuredTextHeight = getMeasuredTextHeight(
            textContent,
            computedStyle,
            fontSize,
            textHeightBase
          );
          const lineHeightFloor = lineBoxCenteringCandidate ? explicitLineHeight : 1;
          const textHeight = Math.min(contentHeight, Math.max(1, measuredTextHeight, lineHeightFloor));
          const verticalAlign = flexTextAlignment ? flexTextAlignment.verticalAlign : resolveVerticalTextAlign(computedStyle);
          const shouldCenterVertically = verticalAlign === "middle" || lineBoxCenteringCandidate;
          let textY = contentY;
          if (shouldCenterVertically) {
            textY = contentY + Math.max(0, (contentHeight - textHeight) / 2);
          } else if (verticalAlign === "bottom") {
            textY = contentY + Math.max(0, contentHeight - textHeight);
          }
          textY = round(textY);
          let textRect = {
            x: round(contentX),
            y: textY,
            width: contentWidth,
            height: textHeight
          };
          if (directTextRect && directTextRect.width > 0 && directTextRect.height > 0 && !lineBoxCenteringCandidate && !flexTextAlignment) {
            textRect = {
              x: directTextRect.x,
              y: directTextRect.y,
              width: directTextRect.width,
              height: directTextRect.height
            };
          }
          const letterSpacing = toNumber(computedStyle.letterSpacing, 0);
          const measuredSingleLineWidth = getMeasuredTextWidth(
            textContent,
            computedStyle,
            fontSize,
            letterSpacing
          );
          const normalizedWhiteSpace = String(computedStyle.whiteSpace || "").toLowerCase();
          const normalizedTextWrapMode = String(
            computedStyle.textWrapMode || computedStyle.getPropertyValue("text-wrap-mode") || ""
          ).toLowerCase();
          const noWrapPreferred = normalizedWhiteSpace === "nowrap" || normalizedWhiteSpace === "pre" || normalizedWhiteSpace === "pre-nowrap" || normalizedTextWrapMode === "nowrap";
          const singleLineLikely = (directTextRect?.lineCount || 0) <= 1 || textRect.height <= Math.max(fontSize, resolvedLineHeight) * 1.35;
          const needsWidthGuard = measuredSingleLineWidth > textRect.width + 0.5;
          if (needsWidthGuard && (noWrapPreferred || singleLineLikely)) {
            const widthGuard = Math.max(2, Math.min(12, Math.abs(letterSpacing) * 2));
            const expandedWidth = round(measuredSingleLineWidth + widthGuard);
            const delta = expandedWidth - textRect.width;
            if (delta > 0) {
              if (textAlign === 1) {
                textRect.x = round(textRect.x - delta / 2);
              } else if (textAlign === 2) {
                textRect.x = round(textRect.x - delta);
              }
              textRect.width = expandedWidth;
            }
          }
          const integerWidth = Math.max(1, Math.ceil(textRect.width));
          const integerWidthDelta = integerWidth - textRect.width;
          if (integerWidthDelta > 0) {
            if (textAlign === 1) {
              textRect.x = round(textRect.x - integerWidthDelta / 2);
            } else if (textAlign === 2) {
              textRect.x = round(textRect.x - integerWidthDelta);
            }
            textRect.width = integerWidth;
          } else {
            textRect.width = integerWidth;
          }
          const textNode = {
            ...createBaseLayerNode({
              id: layerId,
              name: textContent.slice(0, 40),
              rect: textRect,
              opacity
            }),
            isNameDynamic: true,
            type: 0,
            backgroundFills: [],
            strokes: [],
            strokePattern: [],
            strokeThickness: 0,
            textAlignment: textAlign,
            effects: parseShadowList(computedStyle.textShadow),
            textShadows: parseShadowList(computedStyle.textShadow),
            text: {
              paragraphs: [
                {
                  horizontalAlignment: textAlign,
                  lineSpacing: hasExplicitLineHeight ? round(explicitLineHeight) : 0,
                  inlines: [
                    {
                      type: 0,
                      text: textContent,
                      family: primaryFamily,
                      typeface: `${primaryFamily} - ${getWeightName(fontWeight)}`,
                      weight: fontWeight,
                      size: round(fontSize),
                      textColor,
                      style: 0,
                      underline,
                      strikethrough,
                      characterSpacing: round(letterSpacing)
                    }
                  ]
                }
              ]
            }
          };
          const textClipContainer = preserveHierarchy ? resolveClipContainer(currentElement, rootPageX, rootPageY, {
            includeSelf: true
          }) : null;
          if (textClipContainer) {
            const textMaskNode = createMaskWrapperNode({
              id: nextId(),
              name: `${textContent.slice(0, 24)}-text-clip-mask`,
              rect: textClipContainer.rect,
              corners: textClipContainer.corners,
              maskedItems: [textNode]
            });
            targetItems.push(textMaskNode);
          } else {
            targetItems.push(textNode);
          }
        }
      }
    }
    currentElement = walker.nextNode();
  }
  const rootBackgroundColor = window.getComputedStyle(rootElement).backgroundColor || "rgba(255,255,255,1)";
  const backgroundFill = getSolidFill(rootBackgroundColor, !isTransparentColor(rootBackgroundColor)) || getSolidFill("rgba(255,255,255,1)", false);
  const artboardId = nextId();
  const backgroundShapeId = nextId();
  const backgroundShape = createBackgroundShape(
    backgroundShapeId,
    artboardWidth,
    artboardHeight,
    backgroundFill
  );
  const artboard = {
    id: artboardId,
    name: rootName || "Artboard",
    itemType: ITEM_TYPE_ARTBOARD,
    resizingConstraints: getResizingConstraints(),
    isNameDynamic: false,
    rect: {
      location: {
        x: round(rootPageX),
        y: round(rootPageY)
      },
      size: {
        width: artboardWidth,
        height: artboardHeight
      }
    },
    backgroundFill: {
      type: SOLID_FILL_TYPE,
      enabled: false,
      color: backgroundFill.color
    },
    backgroundShape,
    scene: {
      items: sceneItems
    }
  };
  return {
    masters: {},
    imageMap,
    scene: {
      items: [artboard]
    }
  };
}
var html_to_axure_default = htmlToAxure;
export {
  html_to_axure_default as default,
  htmlToAxure
};
