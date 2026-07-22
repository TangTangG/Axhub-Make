import { useEffect, useState, type ElementType, type SVGProps } from 'react';
import type { CanvasAiScene } from '../../domains/shared/CanvasGenerationComposer';
import {
  resolveResourceStartPromptSelection,
  type ResourceStartPromptImageSize,
  type ResourceStartPromptScene,
} from './resourceStartPromptSelection';

export type ResourceStartPromptCard = {
  id: string;
  scene: ResourceStartPromptScene;
  title: string;
  prompt: string;
  icon: ElementType<SVGProps<SVGSVGElement>>;
  imageSize?: ResourceStartPromptImageSize;
  prdPlanning?: 'enable' | 'disable';
};

export function ResourceStartPromptGrid({
  cards,
  activeScene,
  disabled,
  selectPrompt,
  onSceneChange,
  onImageSizeChange,
  onPrdPlanningChange,
}: {
  cards: readonly ResourceStartPromptCard[];
  activeScene: CanvasAiScene;
  disabled: boolean;
  selectPrompt: (prompt: string) => void;
  onSceneChange: (scene: ResourceStartPromptScene) => void;
  onImageSizeChange: (size: ResourceStartPromptImageSize) => void;
  onPrdPlanningChange: (enabled: boolean) => void;
}) {
  const [pendingSelection, setPendingSelection] = useState<{
    scene: ResourceStartPromptScene;
    prompt: string;
  } | null>(null);

  useEffect(() => {
    if (disabled || !pendingSelection || pendingSelection.scene !== activeScene) return;
    selectPrompt(pendingSelection.prompt);
    setPendingSelection(null);
  }, [activeScene, disabled, pendingSelection, selectPrompt]);

  const handleSelectCard = (card: ResourceStartPromptCard) => {
    if (disabled) return;
    if (card.imageSize) {
      onImageSizeChange(card.imageSize);
    }
    if (card.prdPlanning) {
      onPrdPlanningChange(card.prdPlanning === 'enable');
    }
    const selection = resolveResourceStartPromptSelection({ card, activeScene });
    if (selection.type === 'apply') {
      selectPrompt(selection.prompt);
      return;
    }
    setPendingSelection({ scene: selection.scene, prompt: selection.prompt });
    onSceneChange(selection.scene);
  };

  return (
    <ul
      className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="资源生成能力"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <li key={card.id} className="flex">
            <button
              type="button"
              aria-label={card.title}
              disabled={disabled}
              onClick={() => handleSelectCard(card)}
              className="group flex min-h-16 w-full items-center gap-3 rounded-[10px] border border-slate-200/80 bg-white/80 px-4 py-3 text-left text-[13px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-slate-600" aria-hidden="true" />
              <span className="leading-5">{card.title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
