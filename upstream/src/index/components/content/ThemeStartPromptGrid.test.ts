import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { ThemeStartPromptGrid } from './ThemeStartPromptGrid';

describe('theme start prompt grid', () => {
  it('fills the theme composer when a card is selected', async () => {
    const selectPrompt = vi.fn();
    const TestIcon = () => React.createElement('svg');
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(React.createElement(ThemeStartPromptGrid, {
        cards: [{ id: 'generate', title: '普通生成', prompt: 'Create a theme.', icon: TestIcon }],
        disabled: false,
        selectPrompt,
      }));
    });
    await act(async () => {
      renderer.root.findByType('button').props.onClick();
    });

    expect(selectPrompt).toHaveBeenCalledOnce();
    expect(selectPrompt).toHaveBeenCalledWith('Create a theme.');
  });

  it('does not fill the composer while disabled', async () => {
    const selectPrompt = vi.fn();
    const TestIcon = () => React.createElement('svg');
    let renderer: ReactTestRenderer;

    await act(async () => {
      renderer = create(React.createElement(ThemeStartPromptGrid, {
        cards: [{ id: 'generate', title: '普通生成', prompt: 'Create a theme.', icon: TestIcon }],
        disabled: true,
        selectPrompt,
      }));
    });
    await act(async () => {
      renderer.root.findByType('button').props.onClick();
    });

    expect(selectPrompt).not.toHaveBeenCalled();
  });
});
