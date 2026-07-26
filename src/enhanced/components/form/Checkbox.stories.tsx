import type { Meta, StoryObj } from '@storybook/react';
import Checkbox from './Checkbox';

const meta: Meta<typeof Checkbox> = {
  title: 'Form/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    indeterminate: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Checkbox>;

export const Default: Story = {
  args: {
    children: '选项',
  },
};

export const Hover: Story = {
  args: {
    children: '悬停状态',
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Checked: Story = {
  args: {
    checked: true,
    children: '已选中',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    children: '禁用状态',
  },
};

export const DisabledChecked: Story = {
  args: {
    disabled: true,
    checked: true,
    children: '禁用已选中',
  },
};

export const Indeterminate: Story = {
  args: {
    indeterminate: true,
    children: '半选状态',
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Checkbox>Default</Checkbox>
      <Checkbox defaultChecked>Checked</Checkbox>
      <Checkbox disabled>Disabled</Checkbox>
      <Checkbox disabled checked>
        Disabled Checked
      </Checkbox>
      <Checkbox indeterminate>Indeterminate</Checkbox>
    </div>
  ),
};
