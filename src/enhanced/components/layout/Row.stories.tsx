import type { Meta, StoryObj } from '@storybook/react';
import Row from './Row';
import Col from './Col';

const meta: Meta<typeof Row> = {
  title: 'Layout/Row',
  component: Row,
  tags: ['autodocs'],
  argTypes: {
    gutter: { control: 'object' },
    justify: {
      control: 'select',
      options: ['start', 'end', 'center', 'space-around', 'space-between'],
    },
    align: {
      control: 'select',
      options: ['top', 'middle', 'bottom'],
    },
    wrap: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Row>;

const ColBox = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      backgroundColor: 'var(--color-bg-secondary)',
      padding: 'var(--spacing-md)',
      textAlign: 'center',
      borderRadius: 'var(--radius-sm)',
      border: '1px solid var(--color-border-default)',
    }}
  >
    {children}
  </div>
);

export const Default: Story = {
  args: {
    gutter: 16,
    children: (
      <>
        <Col span={8}>
          <ColBox>col-8</ColBox>
        </Col>
        <Col span={8}>
          <ColBox>col-8</ColBox>
        </Col>
        <Col span={8}>
          <ColBox>col-8</ColBox>
        </Col>
      </>
    ),
  },
};
