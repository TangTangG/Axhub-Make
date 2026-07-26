import type { Meta, StoryObj } from '@storybook/react';
import Card from './Card';

const meta: Meta<typeof Card> = {
  title: 'Layout/Card',
  component: Card,
  tags: ['autodocs'],
  argTypes: {
    title: { control: 'text' },
    bordered: { control: 'boolean' },
    hoverable: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    title: 'Card Title',
    children: 'Card content goes here. This is the default state.',
  },
};

export const Hover: Story = {
  args: {
    title: 'Hoverable Card',
    hoverable: true,
    children: 'Hover over this card to see the shadow effect.',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const NoTitle: Story = {
  args: {
    children: 'Card without a title, just body content.',
  },
};

export const WithExtra: Story = {
  args: {
    title: 'Card with Extra',
    extra: <a style={{ color: 'var(--color-primary)', fontSize: 'var(--font-size-sm)' }}>More</a>,
    children: 'This card has an extra action in the header.',
  },
};

export const NotBordered: Story = {
  args: {
    title: 'No Border',
    bordered: false,
    hoverable: true,
    children: 'This card has no border but supports hover shadow.',
  },
};
