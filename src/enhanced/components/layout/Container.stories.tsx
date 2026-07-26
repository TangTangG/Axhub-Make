import type { Meta, StoryObj } from '@storybook/react';
import Container from './Container';

const meta: Meta<typeof Container> = {
  title: 'Layout/Container',
  component: Container,
  tags: ['autodocs'],
  argTypes: {
    maxWidth: { control: 'text' },
    padding: { control: 'text' },
    centered: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Container>;

export const Default: Story = {
  args: {
    maxWidth: 1200,
    padding: '0 var(--spacing-md)',
    centered: true,
    children: (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          padding: 'var(--spacing-lg)',
          textAlign: 'center',
          borderRadius: 'var(--radius-md)',
        }}
      >
        Container Content
      </div>
    ),
  },
};
