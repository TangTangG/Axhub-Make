import type { Meta, StoryObj } from '@storybook/react';
import Text from './Text';

const meta: Meta<typeof Text> = {
  title: 'Basic/Text',
  component: Text,
  tags: ['autodocs'],
  argTypes: {
    content: { control: 'text' },
    fontSize: { control: 'text' },
    fontWeight: { control: 'text' },
    color: { control: 'color' },
    textAlign: { control: 'select', options: ['left', 'center', 'right'] },
    lineHeight: { control: 'text' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Text>;

export const Default: Story = {
  args: {
    content: 'This is a text component',
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-regular)',
  },
};

export const Hover: Story = {
  args: {
    content: 'Hover over this text',
    fontSize: 'var(--font-size-md)',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Disabled: Story = {
  args: {
    content: 'This text is disabled',
    fontSize: 'var(--font-size-md)',
    disabled: true,
  },
};

export const LargeTitle: Story = {
  args: {
    content: 'Large Title Text',
    fontSize: 'var(--font-size-xxl)',
    fontWeight: 'var(--font-weight-bold)',
  },
};

export const Centered: Story = {
  args: {
    content: 'Centered text content',
    fontSize: 'var(--font-size-lg)',
    textAlign: 'center',
  },
};

export const CustomColor: Story = {
  args: {
    content: 'Colored text',
    fontSize: 'var(--font-size-md)',
    color: 'var(--color-primary)',
  },
};
