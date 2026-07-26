import type { Meta, StoryObj } from '@storybook/react';
import Slider from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'Form/Slider',
  component: Slider,
  tags: ['autodocs'],
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    defaultValue: 50,
  },
};

export const Hover: Story = {
  args: {
    defaultValue: 50,
  },
  parameters: {
    pseudo: { hover: true },
  },
};

export const Active: Story = {
  args: {
    defaultValue: 75,
  },
  parameters: {
    pseudo: { active: true },
  },
};

export const Disabled: Story = {
  args: {
    defaultValue: 50,
    disabled: true,
  },
};

export const CustomRange: Story = {
  args: {
    min: 0,
    max: 200,
    step: 10,
    defaultValue: 100,
  },
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '400px' }}>
      <Slider defaultValue={30} />
      <Slider defaultValue={60} />
      <Slider defaultValue={50} disabled />
      <Slider min={0} max={200} step={20} defaultValue={100} />
    </div>
  ),
};
