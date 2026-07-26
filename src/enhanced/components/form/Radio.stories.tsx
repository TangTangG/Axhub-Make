import type { Meta, StoryObj } from '@storybook/react';
import Radio from './Radio';

const meta: Meta<typeof Radio> = {
  title: 'Form/Radio',
  component: Radio,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Radio>;

const defaultOptions = [
  { label: '选项一', value: '1' },
  { label: '选项二', value: '2' },
  { label: '选项三', value: '3' },
];

const optionsWithDisabled = [
  { label: '选项一', value: '1' },
  { label: '选项二（禁用）', value: '2', disabled: true },
  { label: '选项三', value: '3' },
];

export const Default: Story = {
  args: {
    options: defaultOptions,
  },
};

export const Hover: Story = {
  args: {
    options: defaultOptions,
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Checked: Story = {
  args: {
    options: defaultOptions,
    value: '1',
  },
};

export const Disabled: Story = {
  args: {
    options: defaultOptions,
    disabled: true,
  },
};

export const WithDisabledOption: Story = {
  args: {
    options: optionsWithDisabled,
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <Radio options={defaultOptions} />
      <Radio options={defaultOptions} value="2" />
      <Radio options={defaultOptions} disabled />
      <Radio options={optionsWithDisabled} value="1" />
    </div>
  ),
};
