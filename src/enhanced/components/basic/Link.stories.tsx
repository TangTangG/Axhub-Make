import type { Meta, StoryObj } from '@storybook/react';
import Link from './Link';

const meta: Meta<typeof Link> = {
  title: 'Basic/Link',
  component: Link,
  tags: ['autodocs'],
  argTypes: {
    href: { control: 'text' },
    target: { control: 'select', options: ['_blank', '_self'] },
    underline: { control: 'boolean' },
    disabled: { control: 'boolean' },
    children: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {
  args: {
    href: 'https://example.com',
    children: 'Default Link',
  },
};

export const Hover: Story = {
  args: {
    href: 'https://example.com',
    children: 'Hover Link',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Active: Story = {
  args: {
    href: 'https://example.com',
    children: 'Active Link',
  },
  parameters: {
    pseudo: { active: true },
  },
};

export const Visited: Story = {
  args: {
    href: 'https://example.com/visited',
    children: 'Visited Link',
  },
  parameters: {
    pseudo: { visited: true },
  },
};

export const Underline: Story = {
  args: {
    href: 'https://example.com',
    children: 'Underline Link',
    underline: true,
  },
};

export const Disabled: Story = {
  args: {
    href: 'https://example.com',
    children: 'Disabled Link',
    disabled: true,
  },
};

export const ExternalLink: Story = {
  args: {
    href: 'https://example.com',
    children: 'External Link',
    target: '_blank',
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Link href="https://example.com">Default</Link>
      <Link href="https://example.com" underline>Underline</Link>
      <Link href="https://example.com" disabled>Disabled</Link>
      <Link href="https://example.com" target="_blank">External (_blank)</Link>
    </div>
  ),
};
