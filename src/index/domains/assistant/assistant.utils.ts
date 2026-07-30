import type { AssistantContextElements } from './assistant.types';

export function mergeSelectedElementsBySelector(
    previous: AssistantContextElements,
    incoming: AssistantContextElements,
): AssistantContextElements {
    const normalizedPrev = Array.isArray(previous) ? previous : [];
    const normalizedIncoming = Array.isArray(incoming) ? incoming : [];
    const merged = [...normalizedPrev];
    const seen = new Set(merged.map((item) => String(item?.selector || '').trim()).filter(Boolean));

    for (const item of normalizedIncoming) {
        const selector = String(item?.selector || '').trim();
        if (!selector || seen.has(selector)) continue;
        merged.push(item);
        seen.add(selector);
    }

    return merged;
}

export function dedupeSelectedElementsByTriple(
    items: AssistantContextElements,
): AssistantContextElements {
    const normalized = Array.isArray(items) ? items : [];
    const out: AssistantContextElements = [];
    const seen = new Set<string>();

    for (const item of normalized) {
        const tag = String(item?.tag || '').trim();
        const selector = String(item?.selector || '').trim();
        const label = String(item?.label || '').trim();
        if (!tag || !selector || !label) continue;
        const key = `${tag}::${selector}::${label}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ tag, selector, label });
    }

    return out;
}
