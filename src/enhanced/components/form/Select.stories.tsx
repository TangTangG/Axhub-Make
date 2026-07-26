import type { Meta, StoryObj } from '@storybook/react';
import Select from './Select';

const meta: Meta<typeof Select> = {
  title: 'Form/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    errorMessage: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof Select>;

const defaultOptions = [
  { label: '选项一', value: '1' },
  { label: '选项二', value: '2' },
  { label: '选项三', value: '3' },
  { label: '选项四（禁用）', value: '4', disabled: true },
];

export const Default: Story = {
  args: {
    options: defaultOptions,
    placeholder: '请选择',
  },
};

export const Hover: Story = {
  args: {
    options: defaultOptions,
    placeholder: '悬停状态',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Focus: Story = {
  args: {
    options: defaultOptions,
    placeholder: '聚焦状态',
  },
  parameters: {
    pseudo: { focus: true },
  },
};

export const Disabled: Story = {
  args: {
    options: defaultOptions,
    placeholder: '禁用状态',
    disabled: true,
  },
};

export const Error: Story = {
  args: {
    options: defaultOptions,
    placeholder: '错误状态',
    error: true,
    errorMessage: '请选择一个选项',
  },
};

export const Open: Story = {
  args: {
    options: defaultOptions,
    defaultValue: '1',
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector('[role="combobox"]');
    if (trigger) {
      (trigger as HTMLElement).click();
    }
  },
};

export const WithValue: Story = {
  args: {
    options: defaultOptions,
    value: '2',
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '300px' }}>
      <Select options={defaultOptions} placeholder="Default" />
      <Select options={defaultOptions} placeholder="Disabled" disabled />
      <Select options={defaultOptions} placeholder="Error" error errorMessage="请必选" />
      <Select options={defaultOptions} value="1" />
    </div>
  ),
};
