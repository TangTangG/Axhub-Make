import type { Meta, StoryObj } from '@storybook/react';
import Col from './Col';

const meta: Meta<typeof Col> = {
  title: 'Layout/Col',
  component: Col,
  tags: ['autodocs'],
  argTypes: {
    span: { control: { type: 'number', min: 1, max: 24 } },
    offset: { control: { type: 'number', min: 0, max: 24 } },
    flex: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Col>;

const ColBox = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      backgroundColor: 'var(--color-primary)',
      color: 'var(--color-text-inverse)',
      padding: 'var(--spacing-md)',
      textAlign: 'center',
      borderRadius: 'var(--radius-sm)',
    }}
  >
    {children}
  </div>
);

export const Default: Story = {
  args: {
    span: 12,
    children: <ColBox>col-12</ColBox>,
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
};

export const WithOffset: Story = {
  args: {
    span: 8,
    offset: 4,
    children: <ColBox>col-8 offset-4</ColBox>,
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex' }}>
        <Story />
      </div>
    ),
  ],
};

export const FlexMode: Story = {
  args: {
    flex: 1,
    children: <ColBox>flex: 1</ColBox>,
  },
  decorators: [
    (Story) => (
      <div style={{ display: 'flex' }}>
        <Story />
        <div
          style={{
            flex: 2,
            backgroundColor: 'var(--color-bg-secondary)',
            padding: 'var(--spacing-md)',
            textAlign: 'center',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          flex: 2
        </div>
      </div>
    ),
  ],
};
