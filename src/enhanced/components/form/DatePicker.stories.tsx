import type { Meta, StoryObj } from '@storybook/react';
import DatePicker from './DatePicker';

const meta: Meta<typeof DatePicker> = {
  title: 'Form/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    errorMessage: { control: 'text' },
    format: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  args: {
    placeholder: '选择日期',
  },
};

export const Hover: Story = {
  args: {
    placeholder: '悬停状态',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Focus: Story = {
  args: {
    placeholder: '聚焦状态',
  },
  parameters: {
    pseudo: { focus: true },
  },
};

export const Disabled: Story = {
  args: {
    placeholder: '禁用状态',
    disabled: true,
  },
};

export const Error: Story = {
  args: {
    placeholder: '错误状态',
    error: true,
    errorMessage: '请选择日期',
  },
};

export const WithValue: Story = {
  args: {
    value: '2026-07-27',
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px' }}>
      <DatePicker placeholder="Default" />
      <DatePicker placeholder="Disabled" disabled />
      <DatePicker placeholder="Error" error errorMessage="请选择日期" />
      <DatePicker value="2026-07-27" />
    </div>
  ),
};
