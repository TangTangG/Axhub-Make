import React, { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import '../ai-image/AiImageGenerationComposer.css';
import type { ThreadMessage } from '@assistant-ui/react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';

import CanvasGenerationComposer, {
  extractCanvasGenerationReferenceImagesFromMessage,
  type CanvasGenerationComposerPlacement,
  type CanvasGenerationSubmitResult,
} from '../shared/CanvasGenerationComposer';
import type { ThemeResourceItem } from '../resources/resource.types';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  NO_PROTOTYPE_THEME_VALUE,
  resolvePrototypeGenerationInitialThemeName,
  resolvePrototypeGenerationSyncedThemeName,
} from './prototypeGenerationThemeSelection';

export interface PrototypeGenerationComposerSettings {
  count: number;
  themeName: string;
}

export interface PrototypeGenerationComposerProps {
  allowAttachments?: true;
  canPasteReferenceImages?: boolean;
  defaultThemeName?: string | null;
  initialReferenceImages?: string[];
  onPasteReferenceImages?: () => Promise<string[]>;
  placement: CanvasGenerationComposerPlacement;
  themes?: ThemeResourceItem[];
  onSubmitPrompt: (
    prompt: string,
    message: ThreadMessage,
    settings: PrototypeGenerationComposerSettings,
    referenceImages: string[],
  ) => Promise<CanvasGenerationSubmitResult>;
}

const COUNT_OPTIONS = [1, 2, 3, 4];
const PROTOTYPE_SETTINGS_SELECT_CONTENT_STYLE = { zIndex: 1400 } satisfies CSSProperties;

export default function PrototypeGenerationComposer({
  canPasteReferenceImages,
  defaultThemeName,
  initialReferenceImages,
  onPasteReferenceImages,
  placement,
  themes,
  onSubmitPrompt,
}: PrototypeGenerationComposerProps) {
  const [generationCount, setGenerationCount] = useState(1);
  const [selectedThemeName, setSelectedThemeName] = useState(() => resolvePrototypeGenerationInitialThemeName(themes, defaultThemeName));
  const [submitting, setSubmitting] = useState(false);
  const previousDefaultThemeNameRef = useRef(defaultThemeName);
  const userSelectedThemeRef = useRef(false);

  useEffect(() => {
    const previousDefaultThemeName = previousDefaultThemeNameRef.current;
    setSelectedThemeName((current) => resolvePrototypeGenerationSyncedThemeName({
      currentThemeName: current,
      defaultThemeName,
      previousDefaultThemeName,
      themes,
      userSelectedTheme: userSelectedThemeRef.current,
    }));
    previousDefaultThemeNameRef.current = defaultThemeName;
  }, [defaultThemeName, themes]);

  const selectedTheme = useMemo(() => (
    themes?.find((theme) => theme.name === selectedThemeName) || null
  ), [selectedThemeName, themes]);
  const themeLabel = selectedTheme?.displayName || selectedTheme?.name || '无设计系统';
  const countLabel = `${generationCount} 个`;

  const handleSubmitPrompt = useCallback(async (prompt: string, message: ThreadMessage) => {
    const referenceImages = extractCanvasGenerationReferenceImagesFromMessage(message);
    setSubmitting(true);
    try {
      return await onSubmitPrompt(prompt, message, {
        count: generationCount,
        themeName: selectedThemeName === NO_PROTOTYPE_THEME_VALUE ? '' : selectedTheme?.name || '',
      }, referenceImages);
    } finally {
      setSubmitting(false);
    }
  }, [generationCount, onSubmitPrompt, selectedTheme, selectedThemeName]);

  return (
    <CanvasGenerationComposer
      dataAttribute="data-axhub-prototype-composer"
      className="aui-root ax-ai-image-composer-host pointer-events-auto absolute z-[1200]"
      placement={placement}
      placementMode="fixed-bottom-center"
      placeholder="描述要生成的原型"
      ariaLabel="AI 原型生成提示词"
      sendTooltip="生成原型"
      addAttachmentTooltip="添加参考图"
      allowAttachments={true}
      attachmentsClassName="ax-ai-image-composer-attachments"
      canPasteReferenceImages={canPasteReferenceImages}
      rootClassName="ax-ai-image-composer-root"
      footerClassName="ax-ai-image-composer-footer"
      footerLeadingActionsClassName="ax-ai-image-composer-footer-leading-actions"
      footerActionsClassName="ax-ai-image-composer-footer-actions"
      initialReferenceImages={initialReferenceImages}
      onPasteReferenceImages={onPasteReferenceImages}
      submitting={submitting}
      onSubmitPrompt={handleSubmitPrompt}
      renderLeadingActions={() => (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-axhub-prototype-composer-settings-trigger
              className="ax-ai-image-settings-trigger"
              aria-label="原型设置"
            >
              <SlidersHorizontal aria-hidden="true" />
              <span
                data-axhub-prototype-composer-settings-summary
                className="ax-ai-image-settings-summary"
              >
                {countLabel} · {themeLabel}
              </span>
              <ChevronDown aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" side="top" className="z-[1300] w-[320px] p-3">
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="text-sm font-medium text-foreground">原型设置</div>
                <div className="text-xs text-muted-foreground">{countLabel} · {themeLabel}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">生成数量</span>
                  <Select value={String(generationCount)} onValueChange={(value) => setGenerationCount(Number(value))}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={PROTOTYPE_SETTINGS_SELECT_CONTENT_STYLE}>
                      {COUNT_OPTIONS.map((count) => (
                        <SelectItem key={count} value={String(count)}>
                          {count} 个
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">设计系统</span>
                  <Select
                    value={selectedThemeName}
                    onValueChange={(nextThemeName) => {
                      userSelectedThemeRef.current = true;
                      setSelectedThemeName(nextThemeName);
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={PROTOTYPE_SETTINGS_SELECT_CONTENT_STYLE}>
                      <SelectItem value={NO_PROTOTYPE_THEME_VALUE}>无</SelectItem>
                      {(themes || []).map((theme) => (
                        <SelectItem key={theme.name} value={theme.name}>
                          {theme.displayName || theme.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    />
  );
}
