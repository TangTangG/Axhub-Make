import type { Meta, StoryObj } from '@storybook/react';
import Rectangle from './Rectangle';

const meta: Meta<typeof Rectangle> = {
  title: 'Basic/Rectangle',
  component: Rectangle,
  tags: ['autodocs'],
  argTypes: {
    width: { control: 'text' },
    height: { control: 'text' },
    fill: { control: 'color' },
    borderRadius: { control: { type: 'number', min: 0 } },
    borderWidth: { control: { type: 'number', min: 0 } },
    borderColor: { control: 'color' },
    opacity: { control: { type: 'range', min: 0, max: 1, step: 0.1 } },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Rectangle>;

export const Default: Story = {
  args: {
    width: 200,
    height: 100,
    fill: 'var(--color-bg-primary)',
  },
};

export const Hover: Story = {
  args: {
    width: 200,
    height: 100,
    fill: 'var(--color-bg-primary)',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Active: Story = {
  args: {
    width: 200,
    height: 100,
    fill: 'var(--color-bg-primary)',
  },
  parameters: {
    pseudo: { active: true },
  },
};

export const Disabled: Story = {
  args: {
    width: 200,
    height: 100,
    fill: 'var(--color-bg-primary)',
    disabled: true,
  },
};

export const WithBorder: Story = {
  args: {
    width: 200,
    height: 100,
    fill: 'var(--color-bg-primary)',
    borderWidth: 2,
    borderColor: 'var(--color-border-default)',
    borderRadius: 8,
  },
};

export const Rounded: Story = {
  args: {
    width: 200,
    height: 100,
    fill: 'var(--color-primary)',
    borderRadius: 12,
  },
};
