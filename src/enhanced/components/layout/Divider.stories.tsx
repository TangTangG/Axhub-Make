import type { Meta, StoryObj } from '@storybook/react';
import Divider from './Divider';

const meta: Meta<typeof Divider> = {
  title: 'Layout/Divider',
  component: Divider,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
    dashed: { control: 'boolean' },
    orientation: {
      control: 'select',
      options: ['left', 'right', 'center'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Divider>;

export const Default: Story = {
  args: {},
  decorators: [
    (Story) => (
      <div>
        <p style={{ color: 'var(--color-text-primary)', margin: 0 }}>Above</p>
        <Story />
        <p style={{ color: 'var(--color-text-primary)', margin: 0 }}>Below</p>
      </div>
    ),
  ],
};

export const Dashed: Story = {
  args: { dashed: true },
  decorators: [
    (Story) => (
      <div>
        <p style={{ color: 'var(--color-text-primary)', margin: 0 }}>Above</p>
        <Story />
        <p style={{ color: 'var(--color-text-primary)', margin: 0 }}>Below</p>
      </div>
    ),
  ],
};

export const WithText: Story = {
  args: { children: 'Text' },
};

export const OrientationLeft: Story = {
  args: { children: 'Left', orientation: 'left' },
};

export const OrientationRight: Story = {
  args: { children: 'Right', orientation: 'right' },
};

export const Vertical: Story = {
  args: { type: 'vertical' },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ color: 'var(--color-text-primary)' }}>Left</span>
        <Story />
        <span style={{ color: 'var(--color-text-primary)' }}>Right</span>
      </div>
    ),
  ],
};
