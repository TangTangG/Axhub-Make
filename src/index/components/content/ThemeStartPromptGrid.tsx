import { type ElementType, type SVGProps } from 'react';

export type ThemeStartPromptCard = {
  id: string;
  title: string;
  prompt: string;
  icon: ElementType<SVGProps<SVGSVGElement>>;
};

export function ThemeStartPromptGrid({
  cards,
  disabled,
  selectPrompt,
}: {
  cards: readonly ThemeStartPromptCard[];
  disabled: boolean;
  selectPrompt: (prompt: string) => void;
}) {
  return (
    <ul
      className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="主题来源"
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <li key={card.id} className="flex">
            <button
              type="button"
              aria-label={card.title}
              disabled={disabled}
              onClick={() => {
                if (disabled || !card.prompt.trim()) return;
                selectPrompt(card.prompt);
              }}
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
